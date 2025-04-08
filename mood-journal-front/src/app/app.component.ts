import { Component, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LoadingComponent } from './components/loading/loading.component';
import { NgIf, NgClass } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [RouterOutlet, NgIf, NgClass]
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

  showHeaderFooter(): boolean {
    const currentRoute = this.router.url;
    return currentRoute !== '/login' && currentRoute !== '/register';
  }
  
  getPageClass(): string {
    return this.showHeaderFooter() ? '' : 'auth-page';
  }
}