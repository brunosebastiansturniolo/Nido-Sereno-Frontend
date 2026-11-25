import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_VERSION } from '../../app.constants';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html'
})
export class HomeComponent {
  appVersion = APP_VERSION;
}