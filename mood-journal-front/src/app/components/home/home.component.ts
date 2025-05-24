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
  entryPage = true;

  currentMonth = new Date();
  selectedDate: Date = new Date();
  entries: { date: Date, text: string }[] = [
    { date: new Date(), text: 'Feeling good today!' },
    { date: new Date(), text: 'Had a rough day. Had a examen and then broke up with my bf, life is very sad lately.' },
    { date: new Date(), text: 'Just okay.' },
    { date: new Date(), text: 'Feeling great!' },
    { date: new Date(), text: 'Not the best day.' }
  ];
  calendarDays: { date: Date }[] = [];
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    this.generateCalendar();
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

  generateCalendar() {
    const start = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const end = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    const days: { date: Date }[] = [];

    const offset = start.getDay();
    for (let i = 0; i < offset; i++) {
      days.push({ date: new Date(NaN) }); // Placeholder
    }


    for (let i = 1; i <= end.getDate(); i++) {
      days.push({ date: new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), i) });
    }

    this.calendarDays = days;
  }

  previousMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.generateCalendar();
  }

  selectDay(day: { date: Date }) {
    if (!isNaN(day.date.getTime())) {
      this.entryPage = false;
      this.selectedDate = day.date;
    }
  }

  isSelectedDay(day: { date: Date }): boolean {
    return this.selectedDate?.toDateString() === day.date.toDateString();
  }

  getEntriesForDay(date: Date) {
    return this.entries.filter(e => new Date(e.date).toDateString() === date.toDateString()).map(e => e.text);
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date &&
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear();
  }

  getMoodClass(day: Date){
    if (!day || isNaN(day.getTime()) || this.isToday(day)) {
      return '';
    }
    if( day.getDate() % 2 === 0){
      return 'happy';
    } else if (day.getDate() % 3 === 0){
      return 'neutral';
    } else {
      return 'sad';
    }
  }

  get entriesForSelectedDate(): any[] {
    return this.entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getFullYear() === this.selectedDate.getFullYear()
        && entryDate.getMonth() === this.selectedDate.getMonth()
        && entryDate.getDate() === this.selectedDate.getDate();
    });
  }

}