export interface DayEntry {
    id: string;
    entry: string;
    mood: string;
    sentiment_score: number;
    translated_text: string;
    detected_language: string;
    timestamp: string;
    advice: string;
  }
  
export interface AnalyzeMoodResponse {
    message: string;
    entry_id: string;
    mood: string;
    sentiment_score: number;
    translated_text: string | null;
    detected_language: string;
    advice: string;
  }
  
export interface DayMoodResponse {
    success: boolean;
    date: string;
    user_email: string;
    entries_count: number;
    average_sentiment_score: number | null;
    daily_mood: string;
    advice: string;
    message?: string;
  }
  
export interface EntriesResponse {
    success: boolean;
    date: string;
    user_email: string;
    entries_count: number;
    entries: DayEntry[];
  }