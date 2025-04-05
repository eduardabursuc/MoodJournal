import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingComponent } from './components/loading/loading.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [RouterOutlet]
})
export class AppComponent {
  title = 'Frontend';

  @ViewChild('loading') loading!: LoadingComponent;

  loadData() {
    this.loading.show(); // Show the loading screen
    setTimeout(() => {
      // Simulate data loading
      this.loading.hide(); // Hide the loading screen
    }, 3000);
  }
}