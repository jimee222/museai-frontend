// src/app/pages/landing/landing.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NavbarComponent } from '../../components/landing/navbar/navbar.component';
import { HeroComponent } from '../../components/landing/sunrise/sunrise.component';
import { TeamComponent } from '../../components/landing/team/team.component';
import { StoryComponent } from '../../components/landing/story/story.component';
import { VisionComponent } from '../../components/landing/vision/vision.component';
import { ServicesComponent } from '../../components/landing/services/services.component';
import { CasesComponent } from '../../components/landing/cases/cases.component';
import { ContactComponent } from '../../components/landing/contact/contact.component';
import { FooterComponent } from '../../components/landing/footer/footer.component';

import {OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    HeroComponent,
    TeamComponent,
    StoryComponent,
    VisionComponent,
    ServicesComponent,
    CasesComponent,
    ContactComponent,
    FooterComponent,
  ],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements OnInit, OnDestroy {

  currentYear = new Date().getFullYear();

  ngOnInit() {
    document.title = "Code Horizon";

    const favicon = document.getElementById("dynamic-favicon") as HTMLLinkElement;
    if (favicon) {
      favicon.href = "assets/brand/codehorizon-favicon.png";
    }
  }

  ngOnDestroy() {
    document.title = "MuseAI";

    const favicon = document.getElementById("dynamic-favicon") as HTMLLinkElement;
    if (favicon) {
      favicon.href = "assets/favicon.ico";
    }
  }
}
