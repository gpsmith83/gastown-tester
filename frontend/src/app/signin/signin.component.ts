import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signin',
  imports: [CommonModule],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.css'
})
export class SigninComponent implements OnInit {
  isChecking = true;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check if user is already authenticated
    this.authService.checkAuthStatus().subscribe({
      next: (status) => {
        this.isChecking = false;
        if (status.authenticated) {
          // User is already logged in, redirect to workspace
          this.router.navigate(['/workspace']);
        }
      },
      error: (error) => {
        console.error('Auth check failed:', error);
        this.isChecking = false;
      }
    });
  }

  loginWithGitHub(): void {
    this.authService.loginWithGitHub();
  }
}
