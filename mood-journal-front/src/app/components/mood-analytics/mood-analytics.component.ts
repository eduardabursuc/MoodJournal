import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule} from '@angular/common';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mood-analytics',
  templateUrl: './mood-analytics.component.html',
  styleUrls: ['./mood-analytics.component.css'],
  standalone: true,
  imports: [CommonModule]
})

export class MoodAnalyticsComponent implements OnInit {
  lookerReportUrl!: SafeResourceUrl;
  isLoading = true;
  now = new Date();

  constructor(
    private sanitizer: DomSanitizer,
    private userService: UserService,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (!this.userService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    const baseReportUrl = 'https://lookerstudio.google.com/embed/reporting/6f97b76f-ea9f-4006-9a6f-b43fb519758e/page/FwDGF';
    
    // Only using user_id for filtering in Looker Studio as per requirements
    // const userId = this.userService.getCurrentUserId();
    
    // const reportUrl = `${baseReportUrl}?user_id=${encodeURIComponent(userId)}`;
    
    // console.log('Looker Studio URL:', reportUrl);
    
    this.lookerReportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(baseReportUrl);
    
    setTimeout(() => {
      this.isLoading = false;
    }, 1500);
  }
  
  get userId(): string {
    return this.userService.getCurrentUserId();
  }

  onIframeLoad() {
    this.isLoading = false;
  }
}