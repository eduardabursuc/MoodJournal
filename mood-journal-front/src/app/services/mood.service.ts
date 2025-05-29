import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AnalyzeMoodResponse, DayMoodResponse, EntriesResponse } from './types';

@Injectable({
  providedIn: 'root'
})
export class MoodService {

  private baseUrl = 'https://us-central1-moodboardproject-455907.cloudfunctions.net';
  private analyzeMoodUrl = `${this.baseUrl}/analyzeMood`;
  private getEntriesByDayUrl = `${this.baseUrl}/getEntriesByDay`;
  private getMoodForDayUrl = `${this.baseUrl}/getMoodForDay`;

  constructor(private http: HttpClient) { }

  analyzeMood(userId: string, entry: string): Observable<AnalyzeMoodResponse> {
    const body = { user_id: userId, entry: entry };
    return this.http.post<AnalyzeMoodResponse>(this.analyzeMoodUrl, body);
  }

  getEntriesByDay(email: string, date: string): Observable<EntriesResponse> {
    const url = `${this.getEntriesByDayUrl}?email=${encodeURIComponent(email)}&date=${date}`;
    return this.http.get<EntriesResponse>(url);
  }

  getMoodForDay(email: string, date: string): Observable<DayMoodResponse> {
    const url = `${this.getMoodForDayUrl}?email=${encodeURIComponent(email)}&date=${date}`;
    return this.http.get<DayMoodResponse>(url);
  }

  formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}