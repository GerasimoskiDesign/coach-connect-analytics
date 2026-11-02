import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConsentBannerComponent } from './shared/ui/consent-banner/consent-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConsentBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {}
