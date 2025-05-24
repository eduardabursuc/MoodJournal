import { Component } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import { DatePipe, NgFor, NgIf } from '@angular/common';

interface MoodStats {
  last_7_days: {
    Positive: number;
    Neutral: number;
    Negative: number;
  };
  last_30_days: {
    Positive: number;
    Neutral: number;
    Negative: number;
  };
  last_365_days: {
    Positive: number;
    Neutral: number;
    Negative: number;
  };
}

@Component({
  selector: 'app-mood-stats',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe],
  templateUrl: './mood-stats.component.html',
  styleUrl: './mood-stats.component.css'
})
export class MoodStatsComponent {
  userId: string | null = null;
  userEmail: string | null = null;
  moodStats: MoodStats | null = null;
  isLoading = true;
  error: string | null = null;
  now = new Date();
  readonly periods: Array<'last_7_days' | 'last_30_days' | 'last_365_days'> = [
    'last_7_days', 'last_30_days', 'last_365_days'
  ];
  readonly moods: Array<'Positive' | 'Neutral' | 'Negative'> = ['Positive', 'Neutral', 'Negative'];


  constructor(
    private userService: UserService,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (!this.userService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadMoodStats();
  }

  loadMoodStats(): void {
    this.userId = this.userService.getCurrentUserId();
    if (!this.userId) {
      console.error('User ID not found. Please log in.');
      return;
    }
    this.userEmail = this.userService.getCurrentUserEmail();
    this.userService.getMoodStats(this.userId).subscribe({
      next: (stats) => {
        // console.log('Mood stats:', stats);
        this.moodStats = stats;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching mood stats:', error);
      }
    });
  }

  getTotal(period: 'last_7_days' | 'last_30_days' | 'last_365_days'): number {
    if (!this.moodStats) return 0;
    const stats = this.moodStats[period];
    return stats.Positive + stats.Neutral + stats.Negative;
  }

  getPercentage(period: 'last_7_days' | 'last_30_days' | 'last_365_days', mood: 'Positive' | 'Neutral' | 'Negative'): number {
    if (!this.moodStats) return 0;
    const total = this.getTotal(period);
    if (total === 0) return 0;
    return Math.round((this.moodStats[period][mood] / total) * 100);
  }

  getPeriodTitle(period: string): string {
    switch (period) {
      case 'last_7_days': return 'Last 7 Days';
      case 'last_30_days': return 'Last 30 Days';
      case 'last_365_days': return 'Last Year';
      default: return period;
    }
  }

  getMoodColor(mood: string): string {
    switch (mood) {
      case 'Positive': return '#4caf50';
      case 'Neutral': return '#ff9800';
      case 'Negative': return '#f44336';
      default: return '#9e9e9e';
    }
  }
}
