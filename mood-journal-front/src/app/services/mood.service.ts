import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MoodService {

  private apiUrl = 'https://us-central1-moodboardproject-455907.cloudfunctions.net/analyzeMood';

  constructor(private http: HttpClient) { }

  analyzeMood(userId: string, entry: string): Observable<any> {
    const body = { user_id: userId, entry: entry };
    return this.http.post<any>(this.apiUrl, body);
  }
}
