import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MoodService } from '../../services/mood.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class HomeComponent implements OnInit {
  loading: boolean = true;
  entry: string = '';
  mood: string = '';
  errorMessage = '';

  constructor(
    private router: Router, 
    private moodJournalService: MoodService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Redirect to login if not logged in
    if (!this.userService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.loading = false;
  }

  get userEmail(): string {
    return this.userService.getCurrentUserEmail();
  }

  get username(): string {
    return this.userService.getUsernameFromEmail(this.userEmail);
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/login']);
  }

  onSubmit(): void {
    if (!this.entry.trim()) {
      this.errorMessage = 'Please enter some text in your journal entry';
      return;
    }
    
    // Get the user ID (Firestore-generated)
    const userId = this.userService.getCurrentUserId();
    
    if (!userId) {
      this.errorMessage = 'User ID not found. Please try logging in again.';
      return;
    }
    
    this.moodJournalService.analyzeMood(userId, this.entry).subscribe({
      next: (response: { mood: string }) => {
        this.mood = response.mood;
        this.errorMessage = '';
      },
      error: (error: any) => {
        console.error('Error analyzing mood:', error);
        this.errorMessage = 'Error analyzing/storing entry: ' + (error.message || 'Unknown error');
      }
    }); 
  }
}