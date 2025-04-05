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

  constructor(
    private readonly userService: UserService,
    private readonly router: Router
  ) {}

  onSubmit() {

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    const credentials = { email: this.email, password: this.password };
    this.userService.register(credentials).subscribe({
      next: (response) => {
        console.log('Success.');
        this.router.navigate(['/login']);
      },
      error : (error) => {
        if (error.status == 409 || error.status == 500) { 
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'An error occurred. Please try again later.';
        }
      }
    });
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
