import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class RegisterComponent{
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private readonly userService: UserService,
    private readonly router: Router
  ) {}

  onSubmit() {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      this.isLoading = false;
      return;
    }

    const credentials = { email: this.email, password: this.password };
    this.userService.register(credentials).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Registration successful.');
          this.router.navigate(['/home']);
        } else {
          this.errorMessage = response.error || 'Registration failed. Please try again.';
          this.isLoading = false;
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Registration error:', error);
        
        if (error.status === 400) {
          this.errorMessage = 'User with this email already exists.';
        } else if (error.status === 409 || error.status === 500) { 
          this.errorMessage = error.error?.message || 'Registration failed.';
        } else {
          this.errorMessage = 'An error occurred. Please try again later.';
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
