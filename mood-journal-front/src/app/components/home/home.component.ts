import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingComponent } from '../loading/loading.component';
import { MoodService } from '../../services/mood.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  imports: [CommonModule, LoadingComponent, FormsModule],
})
export class HomeComponent implements OnInit {

  loading: boolean = true;

  userId: string = 'eduardab@mail.ru';  // Replace with dynamic user info
  entry: string = '';
  mood: string = '';
  errorMessage = '';

  constructor(private router: Router, private moodJournalService: MoodService) {}

  ngOnInit(): void {

    /*var token = localStorage.getItem('userEmail');
    if (!token) {
      this.router.navigate(['/login']);
    }*/

  }

  logout(): void {
    localStorage.removeItem('userEmail');
    this.router.navigate(['/login']);
  }

  onSubmit(): void {
    this.moodJournalService.analyzeMood(this.userId, this.entry).subscribe(
      (response: { mood: string }) => {
        this.mood = response.mood;
      },
      (error: any) => {
        this.errorMessage = 'Error analyzing/storing entry: ' + error.message;
      }
    ); 
  }
}
