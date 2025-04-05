import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { CookieService } from "ngx-cookie-service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['login.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  errorMessage: string = '';

  isModalVisible: boolean = false;

  constructor(
    private readonly userService: UserService,
    private readonly router: Router,
    private readonly cookieService: CookieService
  ) {}

  ngOnInit(): void {
    const user = localStorage.getItem('userEmail');
    if (user) {
      this.router.navigate(['/home']);
    }
  }

  onSubmit() {
    const credentials = { email: this.email, password: this.password };
    this.userService.login(credentials).subscribe({
      next : (response) => {
        localStorage.setItem("userEmail", this.email);
        this.router.navigate(['/home']);
      },
      error: (error) => {
        if (error.status == 401) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'An error occurred. Please try again later.';
        }
      }
    });
  }
  
  navigateToRegister() {
    this.router.navigate(['/register']);
  }
}
