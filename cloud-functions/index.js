const functions = require('@google-cloud/functions-framework');
const language = require('@google-cloud/language');
const { Firestore } = require('@google-cloud/firestore');
const { BigQuery } = require('@google-cloud/bigquery');
const { Translate } = require('@google-cloud/translate').v2;
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const nodemailer = require('nodemailer');

const client = new language.LanguageServiceClient();
const translate = new Translate({projectId: 'moodboardproject-455907'}); 
const db = new Firestore({
  projectId: 'moodboardproject-455907',
  databaseId: 'journal'
});
const bigquery = new BigQuery({
  projectId: 'moodboardproject-455907',
});
const secretClient = new SecretManagerServiceClient();

async function accessSecret(secretName) {
  const name = `projects/moodboardproject-455907/secrets/${secretName}/versions/latest`;
  const [version] = await secretClient.accessSecretVersion({ name });
  return version.payload.data.toString('utf8');
}

functions.http('analyzeMood', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { user_id, entry } = req.body;
  if (!user_id || !entry) {
    res.status(400).json({ error: 'Missing user_id or entry' });
    return;
  }
  
  try {
    let textToAnalyze = entry;
    let detectedLanguage = 'en';
    let translatedText = '';
    
    try {
      // Detect language
      const [detection] = await translate.detect(entry);
      detectedLanguage = Array.isArray(detection) ? detection[0].language : detection.language;
      
      // If not English, translate to English
      if (detectedLanguage && detectedLanguage !== 'en' && detectedLanguage !== 'und') {
        const [translation] = await translate.translate(entry, 'en');
        textToAnalyze = translation;
        translatedText = translation;
        console.log(`Original: "${entry}"`);
        console.log(`Translated from ${detectedLanguage} to English: "${textToAnalyze}"`);
      }
    } catch (err) {
      console.error('Error in language detection/translation:', err);
      // Continue with original text
    }
    
    const [result] = await client.analyzeSentiment({
      document: { content: textToAnalyze, type: 'PLAIN_TEXT' },
    });
    
    const score = result.documentSentiment.score;
    console.log(`Sentiment score: ${score}`);
    
    const mood = score > 0.5 ? 'Positive' : score < -0.5 ? 'Negative' : 'Neutral';
    
    // Create entry data
    const entryData = {
      entry,
      mood,
      sentiment_score: score,
      translated_text: translatedText,
      detected_language: detectedLanguage,
      timestamp: new Date(),
    };
    
    // Get the user document
    const userDocRef = db.collection('users').doc(user_id);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // Add the entry to the user's journal_entries subcollection
    const entryRef = await userDocRef.collection('journal_entries').add(entryData);
    
    // Save to BigQuery (with only user_id as requested)
    const dataset = bigquery.dataset('text_sentiment_analysis');
    const table = dataset.table('sentiment_entries');
    
    await table.insert([{
      user_id, // This is the Firestore-generated ID
      entry,
      mood,
      sentiment_score: score,
      translated_text: translatedText,
      detected_language: detectedLanguage,
      timestamp: new Date(),
    }]);
    
    res.json({ 
      message: 'Entry saved!', 
      entry_id: entryRef.id,
      mood,
      sentiment_score: score,
      translated_text: translatedText || null,
      detected_language: detectedLanguage
    });
  } catch (err) {
    console.error('Error analyzing/storing entry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

functions.http('userAuth', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { action, email, password } = req.body;
  
  if (!action || !email || !password) {
    res.status(400).json({ 
      success: false, 
      error: 'Missing required fields (action, email, password)' 
    });
    return;
  }

  try {
    switch (action) {
      case 'register':
        // Check if user with this email already exists
        const usersQuery = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (!usersQuery.empty) {
          res.status(400).json({ 
            success: false, 
            error: 'User with this email already exists' 
          });
          return;
        }
        
        // Generate a new document with auto ID
        const newUserRef = db.collection('users').doc();
        await newUserRef.set({
          email: email,
          password: password, // Note: In production, you should hash this password
          created_at: new Date()
        });
        
        res.json({ 
          success: true, 
          userId: newUserRef.id,
          email: email
        });
        break;
        
      case 'login':
        const loginQuery = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (loginQuery.empty) {
          res.status(404).json({ 
            success: false, 
            error: 'User not found' 
          });
          return;
        }
        
        const userDoc = loginQuery.docs[0];
        const userData = userDoc.data();
        
        if (userData.password !== password) {
          res.status(401).json({ 
            success: false, 
            error: 'Invalid password' 
          });
          return;
        }
        
        res.json({ 
          success: true, 
          userId: userDoc.id,
          email: email
        });
        break;
        
      default:
        res.status(400).json({ 
          success: false, 
          error: 'Invalid action' 
        });
    }
  } catch (error) {
    console.error('Error in userAuth:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error' 
    });
  }
});

// Cloud Function for email reminders (triggered by Pub/Sub)
functions.cloudEvent('sendMoodReminders', async (cloudEvent) => {
  try {
    console.log('Processing email reminders for all users');
    
    const gmailPassword = await accessSecret('gmail-app-password');
    const gmailEmail = await accessSecret('gmail-email');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailEmail,
        pass: gmailPassword
      }
    });
    
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('No users found in database');
      // For testing, send to yourself
      const testUsers = [{ email: gmailEmail}];
      await sendEmailsToUsers(testUsers, transporter, gmailEmail);
      return { success: 1, users: 0 };
    }
    
    // Process all users with better error handling
    const users = [];
    let skippedCount = 0;
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      
      if (userData.email && isValidEmail(userData.email)) {
        
        users.push({
          id: doc.id,
          email: userData.email
        });
      } else {
        console.warn(`Skipping user ${doc.id}: Invalid or missing email`);
        skippedCount++;
      }
    });
    
    console.log(`Found ${users.length} users with valid emails. Skipped ${skippedCount} users.`);
    
    if (users.length === 0) {
      console.log('No valid users to send emails to');
      return { success: 0, skipped: skippedCount, failure: 0, total: skippedCount };
    }
    
    // Send emails with better logging
    const results = await sendEmailsToUsers(users, transporter, gmailEmail);
    results.skipped = skippedCount;
    
    return results;
    
  } catch (error) {
    console.error('Error in sendMoodReminders function:', error);
    throw error;
  }
});

// Helper function to validate email addresses
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

// Enhanced helper function to send emails to users with better error handling
async function sendEmailsToUsers(users, transporter, fromEmail) {
  let successCount = 0;
  let failureCount = 0;
  const currentDate = new Date().toLocaleDateString();
  
  for (const user of users) {
    try {
      console.log(`Attempting to send email to ${user.email}...`);
      
      const emailText = `Hello,\n\nIt's time to log your mood for today (${currentDate}).\n\nTracking your moods regularly helps you gain insights into your emotional patterns and well-being.\n\nYour Mood Journal Team`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Hello,</h2>
          <p>It's time to log your mood for today (${currentDate}).</p>
          <p>Tracking your moods regularly helps you gain insights into your emotional patterns and well-being.</p>
          <p style="margin: 30px 0;">
            <a href="https://moodboardproject-455907.web.app/log" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Log Today's Mood
            </a>
          </p>
          <p>Your Mood Journal Team</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #777; font-size: 12px;">
            If you don't want to receive these emails, <a href="https://moodboardproject-455907.web.app/profile">update your preferences</a>.
          </p>
        </div>
      `;
      
      // Send email with enhanced content
      await transporter.sendMail({
        from: `"Mood Journal" <${fromEmail}>`,
        to: user.email,
        subject: '📝 Time for your daily mood check-in',
        text: emailText,
        html: emailHtml
      });
      
      successCount++;
      console.log(`✅ Email sent successfully to ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${user.email}:`, error);
      failureCount++;
    }
  }
  
  console.log(`Email sending complete. Success: ${successCount}, Failures: ${failureCount}`);
  return { 
    success: successCount, 
    failure: failureCount, 
    total: users.length 
  };
}