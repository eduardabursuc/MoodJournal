import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { HomeComponent } from './components/home/home.component';
import { MoodAnalyticsComponent } from './components/mood-analytics/mood-analytics.component';
import { MoodStatsComponent } from './components/mood-stats/mood-stats.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'home', component: HomeComponent },
  //{ path: 'analytics', component: MoodAnalyticsComponent },
  { path: 'statistics', component: MoodStatsComponent }
];