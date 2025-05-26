const functions = require('@google-cloud/functions-framework');
const language = require('@google-cloud/language');
const { Firestore } = require('@google-cloud/firestore');
const { BigQuery } = require('@google-cloud/bigquery');
const { Translate } = require('@google-cloud/translate').v2;
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const nodemailer = require('nodemailer');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const { GoogleGenerativeAI } = require('@google/generative-ai'); 
const genAI_client = new GoogleGenerativeAI(GEMINI_API_KEY);

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

async function internalGetAdviceFromGemini(mood, entryText = null) {

  if (!genAI_client) {
    console.error("Gemini AI client is not initialized.");
    return "Advice service is currently unavailable.";
  }

  const model = genAI_client.getGenerativeModel({ model: 'gemini-1.5-flash' });
  let prompt;

  if (entryText) {
    prompt = `You are a compassionate and insightful AI. A user's journal entry has been analyzed with a mood of '${mood}'. The entry is: "${entryText}".
      Provide a medium, supportive, and actionable piece of advice (1-2 sentences, maximum 100 words) based on their entry and mood.
      Focus on a positive next step, a comforting thought, or a reflection point. Avoid generic platitudes.
      Example for Negative mood & entry "I failed my exam": "It's tough to face setbacks. Take a moment to breathe. What's one small thing you learned from this experience that can help you next time?"
      Example for Positive mood & entry "Had a great day with friends": "Wonderful! Cherish these moments. What made today special, and how can you invite more of that joy into your week?"
      But please be creative and explore multiple advices helpful for users struggling with mental health.`;
  } else { // For daily mood
    prompt = `You are a compassionate and insightful AI. A user's overall mood for the day is '${mood}'.
      Provide a short, encouraging, and actionable piece of advice (1-2 sentences, maximum 50 words) based on this daily mood.
      Focus on a positive next step, a comforting thought, or a reflection point for the day. Avoid generic platitudes.
      Example for Negative mood: "It's okay to have challenging days. Be gentle with yourself. What's one small comfort you can give yourself right now?"
      Example for Positive mood: "Great! Ride this wave of positivity. What's one thing you're grateful for from today?"
      But please be creative and explore multiple advices helpful for users struggling with mental health.`;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    return response;
  } catch (error) {
    console.error("Error getting advice from Gemini:", error);
    throw error;
  }
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
    const mood = score > 0.5 ? 'Positive' : score < -0.5 ? 'Negative' : 'Neutral';

    let adviceForEntry = "Advice is not available at this moment.";
    if (genAI_client) {
        try {
            adviceForEntry = await internalGetAdviceFromGemini(mood, entry);
        } catch (adviceError) {
            console.error("Error getting advice for entry in analyzeMood:", adviceError);
        }
    }
    
    const entryData = {
      entry,
      mood,
      sentiment_score: score,
      translated_text: translatedText,
      detected_language: detectedLanguage,
      timestamp: new Date(),
      advice: adviceForEntry
    };
    
    const userDocRef = db.collection('users').doc(user_id);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const entryRef = await userDocRef.collection('journal_entries').add(entryData);
    
    // Save to BigQuery (with only user_id)
    const dataset = bigquery.dataset('text_sentiment_analysis');
    const table = dataset.table('sentiment_entries');
    
    await table.insert([{
      user_id, entry, mood, sentiment_score: score,
      translated_text: translatedText, detected_language: detectedLanguage, timestamp: new Date(), advice: adviceForEntry
    }]);
    
    res.json({ 
      message: 'Entry saved!', entry_id: entryRef.id, mood,
      sentiment_score: score, translated_text: translatedText || null,
      detected_language: detectedLanguage,
      advice: adviceForEntry
    });
  } catch (err) {
    console.error('Error analyzing/storing entry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

functions.http('userAuth', async (req, res) => {
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
          <h2 style="color: #5b6af0;">Hello,</h2>
          <p>It's time to log your mood for today (${currentDate}).</p>
          <p>Tracking your moods regularly helps you gain insights into your emotional patterns and well-being.</p>
          <p style="margin: 30px 0;">
            <a href="https://moodboardproject-455907.web.app/log" 
               style="background-color: #5b6af0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
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

functions.http('getMoodStatsBQ', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { user_id } = req.query;
  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id in query' });
    return;
  }

  const datasetId = 'text_sentiment_analysis';
  const tableId = 'sentiment_entries';
  const projectId = 'moodboardproject-455907';

  const intervals = {
    last_7_days: 7,
    last_30_days: 30,
    last_365_days: 365,
  };

  try {
    const results = {};

    for (const [label, days] of Object.entries(intervals)) {
      const query = `
        SELECT mood, COUNT(*) AS count
        FROM \`${projectId}.${datasetId}.${tableId}\`
        WHERE user_id = @userId
          AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
        GROUP BY mood
      `;

      const options = {
        query,
        params: { userId: user_id, days },
        location: 'us-central1',
      };

      const [job] = await bigquery.createQueryJob(options);
      const [rows] = await job.getQueryResults();

      // Initialize with 0 in case no results for a mood
      const moodStats = { Positive: 0, Neutral: 0, Negative: 0 };

      for (const row of rows) {
        const mood = row.mood;
        if (moodStats[mood] !== undefined) {
          moodStats[mood] = Number(row.count);
        }
      }

      results[label] = moodStats;
    }

    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching BigQuery stats:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

functions.http('getEntriesByDay', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { email, date } = req.query; // expecting date in YYYY-MM-DD format
  
  if (!email || !date) {
    res.status(400).json({ error: 'Missing email or date parameter' });
    return;
  }

  try {
    const usersQuery = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersQuery.empty) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const userDoc = usersQuery.docs[0];
    const userId = userDoc.id;
    
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const entriesQuery = await db.collection('users')
      .doc(userId)
      .collection('journal_entries')
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<=', endOfDay)
      .orderBy('timestamp', 'desc')
      .get();
    
    const entries = [];
    entriesQuery.forEach(doc => {
      const data = doc.data();
      entries.push({
        id: doc.id,
        entry: data.entry,
        mood: data.mood,
        sentiment_score: data.sentiment_score,
        translated_text: data.translated_text,
        detected_language: data.detected_language,
        timestamp: data.timestamp.toDate().toISOString(),
        advice: data.advice
      });
    });
    
    res.json({
      success: true,
      date: date,
      user_email: email,
      entries_count: entries.length,
      entries: entries
    });
    
  } catch (error) {
    console.error('Error in getEntriesByDay:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

functions.http('getMoodForDay', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { email, date } = req.query; // date is expected as YYYY-MM-DD
  if (!email || !date) {
    res.status(400).json({ error: 'Missing email or date parameter' });
    return;
  }

  try {
    const usersQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (usersQuery.empty) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const userId = usersQuery.docs[0].id;
    
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }
    
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
    
    const entriesQuery = await db.collection('users').doc(userId).collection('journal_entries')
      .where('timestamp', '>=', startOfDay).where('timestamp', '<=', endOfDay).get();
    
    let dailyMood = 'No entries';
    let averageScore = null;
    let entryCountForMoodCalculation = 0;
    let adviceForDay = "No specific advice for days without entries.";

    const hasEntriesWithScores = !entriesQuery.empty && entriesQuery.docs.some(doc => typeof doc.data().sentiment_score === 'number');

    if (hasEntriesWithScores) {
      let totalScore = 0;
      entriesQuery.forEach(doc => {
        const data = doc.data();
        if (typeof data.sentiment_score === 'number') {
          totalScore += data.sentiment_score;
          entryCountForMoodCalculation++;
        }
      });
      
      if (entryCountForMoodCalculation > 0) {
        averageScore = totalScore / entryCountForMoodCalculation;
        dailyMood = averageScore > 0.25 ? 'Positive' : averageScore < -0.25 ? 'Negative' : 'Neutral';

        if (genAI_client && dailyMood !== 'No entries' && dailyMood !== 'No valid scores') {
            try {
                adviceForDay = await internalGetAdviceFromGemini(dailyMood);

                const adviceDocId = `${userId}_${date}`;
                await db.collection('daily_mood_advices').doc(adviceDocId).set({
                    user_id: userId,
                    date_string: date,
                    daily_mood: dailyMood,
                    advice_text: adviceForDay,
                    timestamp: new Date()
                }, { merge: true });
                console.log(`Daily mood advice saved/updated for user ${userId} on ${date}`);

            } catch (adviceError) {
                console.error("Error getting or saving daily mood advice:", adviceError);
                adviceForDay = "Could not retrieve or store daily advice at this moment.";
            }
        } else if (!genAI_client) {
            adviceForDay = "Daily advice service is not configured.";
        } else {
            adviceForDay = "Not enough data to determine specific daily advice.";
        }
      } else {
        dailyMood = 'No valid scores';
        adviceForDay = "No entries with valid scores found to determine daily advice.";
      }
    }
    
    res.json({
      success: true, date: date, user_email: email,
      entries_count: entriesQuery.size,
      average_sentiment_score: averageScore !== null ? parseFloat(averageScore.toFixed(4)) : null,
      daily_mood: dailyMood,
      advice: adviceForDay
    });
    
  } catch (error) {
    console.error('Error in getMoodForDay:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

functions.http('getGeminiAdvice', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed.' });
    return;
  }

  const { mood, entryText } = req.body;
  if (!mood) {
    res.status(400).json({ error: 'Missing "mood" in request body.' });
    return;
  }

  if (!genAI_client) {
    console.error("Gemini AI client not initialized for httpGetGeminiAdvice endpoint.");
    res.status(503).json({ error: 'Advice service is temporarily unavailable due to configuration issues.' });
    return;
  }

  try {
    const advice = await internalGetAdviceFromGemini(mood, entryText);
    res.status(200).json({
      requestedMood: mood,
      entryTextProvided: !!entryText,
      advice: advice
    });
  } catch (error) {
    console.error('Error in httpGetGeminiAdvice while processing request:', error);
    res.status(500).json({ error: 'Internal Server Error while generating advice.' });
  }
});