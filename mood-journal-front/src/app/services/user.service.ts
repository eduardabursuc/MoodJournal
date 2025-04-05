import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private readonly apiUrl: string;

  constructor(
    private readonly http: HttpClient
  ) {
    this.apiUrl = `http://localhost:5039/api/user`;
  }

   // Login method
   login(data: { email: string; password: string }): Observable<{ token: string }> {
    const url = `${this.apiUrl}/login`;
    return this.http.post<{ token: string }>(url, data);
  }

  // Register method
  register(data: { email: string; password: string }): Observable<{ email: string }> {
    const url = `${this.apiUrl}`;
    return this.http.post<{ email: string }>(url, data);
  }

}