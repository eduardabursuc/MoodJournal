import { Component, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LoadingComponent } from './components/loading/loading.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [RouterOutlet, NgIf]
})
export class AppComponent {
  title = 'Frontend';

  constructor(private router: Router) {}

  @ViewChild('loading') loading!: LoadingComponent;

  loadData() {
    this.loading.show(); // Show the loading screen
    setTimeout(() => {
      // Simulate data loading
      this.loading.hide(); // Hide the loading screen
    }, 3000);
  }

  showHeaderFooter() : boolean {
    const currentRoute = this.router.url;
    return currentRoute !== '/login' && currentRoute !== '/register';
  }
  
  getPageClass(): string {
    return this.showHeaderFooter() ? '' : 'auth-page';
  }

  isLoggedIn(): boolean {
    // Check if user is logged in by checking local storage or a service
    const userId = localStorage.getItem('userId');
    return !!userId;
  }

  logout(): void {
    // Clear user data from local storage or service
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    
    // Redirect to login page
    this.router.navigate(['/login']);
  }
}