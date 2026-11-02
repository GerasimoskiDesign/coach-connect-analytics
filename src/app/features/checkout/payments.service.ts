import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentDto } from '../../core/models/session-request.models';

/** Demo-only checkout. The mock backend confirms the session; no card data exists anywhere. */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  pay(sessionRequestId: string): Observable<PaymentDto> {
    return this.http.post<PaymentDto>(`${this.base}/payments`, { sessionRequestId });
  }
}
