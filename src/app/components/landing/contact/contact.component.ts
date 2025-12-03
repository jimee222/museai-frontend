// src/app/components/landing/contact/contact.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent {}
