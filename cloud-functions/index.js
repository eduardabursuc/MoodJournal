const functions = require('@google-cloud/functions-framework');
const language = require('@google-cloud/language');
const { Firestore } = require('@google-cloud/firestore');
const { BigQuery } = require('@google-cloud/bigquery');
const client = new language.LanguageServiceClient();
const db = new Firestore({
  projectId: 'moodboardproject-455907',
  databaseId: 'journal'
});
const bigquery = new BigQuery({
  projectId: 'moodboardproject-455907',
});

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
    const [result] = await client.analyzeSentiment({
      document: { content: entry, type: 'PLAIN_TEXT' },
    });
    
    const score = result.documentSentiment.score;
    const mood = score > 0 ? 'Positive' : score < 0 ? 'Negative' : 'Neutral';
    
    const userDocRef = db.collection('users').doc(user_id);
    const entryData = {
      entry,
      mood,
      timestamp: new Date(),
    };
    
    await userDocRef.collection('journal_entries').add(entryData);
    
    const dataset = bigquery.dataset('text_sentiment_analysis');
    const table = dataset.table('sentiment_entries');
    await table.insert([
      {
        user_id,
        entry,
        mood,
        timestamp: new Date(),
      },
    ]);
    
    res.json({ message: 'Entry saved!', mood });
  } catch (err) {
    console.error('Error analyzing/storing entry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});