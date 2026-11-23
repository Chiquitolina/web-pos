import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
bootstrapApplication(AppComponent,{providers:[provideZonelessChangeDetection(),provideServiceWorker('ngsw-worker.js',{enabled:environment.production,registrationStrategy:'registerImmediately'})]}).catch(console.error);
