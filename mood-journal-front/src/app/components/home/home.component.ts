import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MoodService } from '../../services/mood.service';
import { UserService } from '../../services/user.service';
import { DayEntry } from '../../services/types';

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
  adviceForCurrentEntry: string = '';
  entryPage = true;
  selectedDayMood: string | undefined;
  selectedDayAdvice: string | undefined;

  currentMonth = new Date();
  selectedDate: Date = new Date();
  
  dayEntries: DayEntry[] = [];
  dayMoods: Map<string, string> = new Map();
  dayAdvice: Map<string, string> = new Map();
  
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
    this.loadMonthlyMoods();
    this.selectDay({ date: new Date() });
    this.loadMoodForToday();
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
    
    const userId = this.userService.getCurrentUserId();
    
    if (!userId) {
      this.errorMessage = 'User ID not found. Please try logging in again.';
      return;
    }
    
    this.moodJournalService.analyzeMood(userId, this.entry).subscribe({
      next: (response) => {
        this.mood = response.mood;
        this.adviceForCurrentEntry = response.advice; 
        this.errorMessage = '';
        this.entry = ''; 
        
        this.loadEntriesForSelectedDate();
        this.loadMoodForToday();
        if (this.isSelectedDay({ date: new Date() })) {
          this.selectedDayMood = response.mood;
          this.selectedDayAdvice = this.dayAdvice.get(this.moodJournalService.formatDateForAPI(new Date()));
      }
      },
      error: (error: any) => {
        console.error('Error analyzing mood:', error);
        this.errorMessage = 'Error analyzing/storing entry: ' + (error.message || 'Unknown error');
        this.mood = '';
        this.adviceForCurrentEntry = '';
      }
    }); 
  }

  generateCalendar() {
    const start = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const end = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    const days: { date: Date }[] = [];

    const offset = start.getDay();
    for (let i = 0; i < offset; i++) {
      days.push({ date: new Date(NaN) });
    }

    for (let i = 1; i <= end.getDate(); i++) {
      days.push({ date: new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), i) });
    }

    this.calendarDays = days;
  }

  previousMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.generateCalendar();
    this.loadMonthlyMoods();
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.generateCalendar();
    this.loadMonthlyMoods();
  }

  selectDay(day: { date: Date }) {
    if (!isNaN(day.date.getTime())) {
      this.entryPage = false;
      this.selectedDate = new Date(day.date);
      this.loadEntriesForSelectedDate();

      const dateStr = this.moodJournalService.formatDateForAPI(this.selectedDate);
      this.selectedDayMood = this.dayMoods.get(dateStr);
      this.selectedDayAdvice = this.dayAdvice.get(dateStr);
    }
  }

  isSelectedDay(day: { date: Date }): boolean {
    return this.selectedDate?.toDateString() === day.date.toDateString();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date &&
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear();
  }

  loadEntriesForSelectedDate(): void {
    if (!this.selectedDate || isNaN(this.selectedDate.getTime())) {
      return;
    }

    const dateStr = this.moodJournalService.formatDateForAPI(this.selectedDate);
    const email = this.userEmail;

    this.moodJournalService.getEntriesByDay(email, dateStr).subscribe({
      next: (response) => {
        if (response.success) {
          this.dayEntries = response.entries;
        } else {
          this.dayEntries = [];
        }
      },
      error: (error) => {
        console.error('Error loading entries:', error);
        this.dayEntries = [];
      }
    });
  }

  loadMonthlyMoods(): void {
    const email = this.userEmail;
    const start = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const end = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);

    this.dayMoods.clear();
    this.dayAdvice.clear();

    for (let day = 1; day <= end.getDate(); day++) {
      const date = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), day);
      const dateStr = this.moodJournalService.formatDateForAPI(date);
      
      this.moodJournalService.getMoodForDay(email, dateStr).subscribe({
        next: (response) => {
          if (response.success && response.daily_mood && response.daily_mood !== 'No entries') {
            this.dayMoods.set(dateStr, response.daily_mood);
            this.dayAdvice.set(dateStr, response.advice);
          }
        },
        error: (error) => {
          console.error(`Error loading mood for ${dateStr}:`, error);
        }
      });
    }
  }

  loadMoodForToday(): void {
    const today = new Date();
    const dateStr = this.moodJournalService.formatDateForAPI(today);
    const email = this.userEmail;

    this.moodJournalService.getMoodForDay(email, dateStr).subscribe({
      next: (response) => {
        if (response.success && response.daily_mood && response.daily_mood !== 'No entries') {
          this.dayMoods.set(dateStr, response.daily_mood);
          this.dayAdvice.set(dateStr, response.advice);
          
          if (this.isSelectedDay({ date: today })) { //no advice for today, as entries can still be added
            this.selectedDayMood = response.daily_mood;
          }
        }
      },
      error: (error) => {
        console.error('Error loading today\'s mood & advice:', error);
      }
    });
  }

  getMoodClass(day: Date): string {
    if (!day || isNaN(day.getTime()) || this.isToday(day)) {
      return '';
    }

    const dateStr = this.moodJournalService.formatDateForAPI(day);
    const mood = this.dayMoods.get(dateStr);
    console.log(`getMoodClass for ${dateStr}: mood is '${mood}'`);

    switch (mood) {
      case 'Positive':
        return 'happy';
      case 'Neutral':
        return 'neutral';
      case 'Negative':
        return 'sad';
      default:
        return ''; // No mood data available
    }
  }

  getMoodAdviceClass(mood: string | undefined): string {
    if (!mood || mood === 'No entries') {
      return '';
    }
    switch (mood) {
      case 'Positive':
        return 'positive';
      case 'Neutral':
        return 'neutral';
      case 'Negative':
        return 'negative';
      default:
        return '';
    }
  }

  getEntriesForDay(date: Date): string[] {
    if (this.selectedDate && date.getTime() === this.selectedDate.getTime()) {
      return this.dayEntries.map(entry => entry.entry);
    }
    return [];
  }

  get entriesForSelectedDate(): DayEntry[] {
    return this.dayEntries;
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getMoodBadgeClass(mood: string): string {
    switch (mood) {
      case 'Positive':
        return 'badge-positive';
      case 'Neutral':
        return 'badge-neutral';
      case 'Negative':
        return 'badge-negative';
      default:
        return 'badge-default';
    }
  }

  getFallbackAdviceForMood(mood: string | undefined): string {
    if (!mood || mood === 'No entries') {
      return "Keep tracking your feelings to see patterns emerge!";
    }
    switch (mood) {
      case 'Positive':
        return "That's great! Reflect on what made today positive and try to carry that forward.";
      case 'Neutral':
        return "A neutral day is a good time for reflection. What's one small thing you can do to uplift your spirits tomorrow?";
      case 'Negative':
        return "It's okay to have off days. Be kind to yourself. What's one small act of self-care you can do right now?";
      default:
        return "Every entry helps you understand yourself better.";
    }
  }

}