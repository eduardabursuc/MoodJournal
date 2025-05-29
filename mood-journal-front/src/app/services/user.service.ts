import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly authApiUrl: string;
  
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private readonly http: HttpClient) {
    this.authApiUrl = 'https://us-central1-moodboardproject-455907.cloudfunctions.net';
    
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    const storedUserId = localStorage.getItem('userId');
    const storedEmail = localStorage.getItem('userEmail');
    
    if (storedUserId && storedEmail) {
      this.currentUserSubject.next({
        id: storedUserId,
        email: storedEmail
      });
    }
  }

  login(data: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.authApiUrl}/userAuth`, {
      action: 'login',
      email: data.email,
      password: data.password
    }).pipe(
      tap(response => {
        if (response.success) {
          this.saveUserToStorage(response.userId, data.email);
        }
      }),
      catchError(error => {
        console.error('Login error:', error);
        return of({ 
          success: false, 
          error: error.error?.error || 'Login failed' 
        });
      })
    );
  }

  register(data: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.authApiUrl}/userAuth`, {
      action: 'register',
      email: data.email,
      password: data.password
    }).pipe(
      tap(response => {
        if (response.success) {
          this.saveUserToStorage(response.userId, data.email);
        }
      }),
      catchError(error => {
        console.error('Registration error:', error);
        return of({ 
          success: false, 
          error: error.error?.error || 'Registration failed' 
        });
      })
    );
  }

  private saveUserToStorage(userId: string, email: string) {
    localStorage.setItem('userId', userId);
    localStorage.setItem('userEmail', email);
    
    this.currentUserSubject.next({
      id: userId,
      email: email
    });
  }

  getCurrentUserId(): string {
    return this.currentUserSubject.value?.id || '';
  }

  getCurrentUserEmail(): string {
    return this.currentUserSubject.value?.email || '';
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  logout(): void {
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    this.currentUserSubject.next(null);
  }

  getUsernameFromEmail(email: string): string {
    return email ? email.split('@')[0] : 'User';
  }

  getMoodStats(userId: string): Observable<any> {
    return this.http.get<any>(`${this.authApiUrl}/getMoodStatsBQ`, {
      params: { user_id: userId }
    }).pipe(
      catchError(error => {
        console.error('Error fetching mood stats:', error);
        return of({ success: false, error: 'Failed to fetch mood stats' });
      })
    );
  }
}