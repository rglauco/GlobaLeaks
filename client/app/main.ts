// https://github.com/globaleaks/GlobaLeaks/issues/3277
// Create a proxy to override localStorage methods with sessionStorage methods
(function() {
  const localStorageProxy = {
    getItem: (key: string) => sessionStorage.getItem(key),
    setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
    removeItem: (key: string) => sessionStorage.removeItem(key),
    clear: () => sessionStorage.clear(),
    key: (index: number) => sessionStorage.key(index),
    get length() {
      return sessionStorage.length;
    }
  };

  // Assign the proxy to localStorage
  Object.defineProperty(window, 'localStorage', {
    value: localStorageProxy,
    configurable: false,
    writable: false
  });
})();

import { ReceiptValidatorDirective } from "@app/shared/directive/receipt-validator.directive";
import { mockEngine } from "@app/services/helper/mocks";
import { MarkdownRendererService } from '@app/services/helper/markdown.service';
import { TranslatorPipe } from "@app/shared/pipes/translate";
import { TranslateService, TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient, HttpClient } from "@angular/common/http";
import { appInterceptor, ErrorCatchingInterceptor, CompletedInterceptor } from "@app/services/root/app-interceptor.service";
import { APP_BASE_HREF, LocationStrategy, HashLocationStrategy, NgOptimizedImage } from "@angular/common";
import { FlowInjectionToken, NgxFlowModule } from "@flowjs/ngx-flow";
import { NgbDatepickerI18n, NgbModule, NgbPaginationConfig, NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import { CustomDatepickerI18n } from "@app/shared/services/custom-datepicker-i18n";
import { appRoutes } from "@app/app.routes";
import { BrowserModule, bootstrapApplication } from "@angular/platform-browser";
import { provideAnimations } from "@angular/platform-browser/animations";
import { NgSelectModule } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { NgIdleKeepaliveModule } from "@ng-idle/keepalive";
import { MarkdownModule, MARKED_OPTIONS } from "ngx-markdown";
import { AppComponent, createTranslateLoader } from "@app/pages/app/app.component";
import { provideRouter } from "@angular/router";
import { ApplicationRef, importProvidersFrom } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import Flow from "@flowjs/flow.js";

bootstrapApplication(AppComponent, {
    providers: [
        provideRouter(appRoutes),
        importProvidersFrom(NgbModule,
                            BrowserModule,
                            NgSelectModule,
                            NgxFlowModule,
                            NgOptimizedImage,
                            FormsModule,
                            NgbTooltipModule,
                            NgIdleKeepaliveModule.forRoot(),
                            MarkdownModule.forRoot({
                              markedOptions: {
                                provide: MARKED_OPTIONS,
                                useFactory: (rendererService: MarkdownRendererService) => ({
                                  breaks: true,
                                  renderer: rendererService.getCustomRenderer(),
                                }),
                                deps: [MarkdownRendererService]
                              }
                            }),
                            TranslateModule.forRoot({
                              loader: {
                                provide: TranslateLoader,
                                useFactory: createTranslateLoader,
                                deps: [HttpClient],
                              },
                            })),
        { provide: APP_BASE_HREF, useValue: "/" },
        { provide: HTTP_INTERCEPTORS, useClass: appInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ErrorCatchingInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: CompletedInterceptor, multi: true },
        { provide: FlowInjectionToken, useValue: Flow },
        { provide: LocationStrategy, useClass: HashLocationStrategy },
        { provide: NgbDatepickerI18n, useClass: CustomDatepickerI18n },
        {
          provide: NgbPaginationConfig,
          useFactory: () => {
            const config = new NgbPaginationConfig();
            config.size = 'sm';           // Set pagination size (sm for small, lg for large)
            config.boundaryLinks = true;  // Display boundary links (first/last)
            config.directionLinks = true; // Display previous/next buttons
            config.maxSize = 20;          // Maximum number of pages displayed
            config.rotate = true;         // Whether to rotate pages when maxSize > number of pages.
            config.ellipses = true;       // If true, the ellipsis symbols and first/last page numbers
                                          // will be shown when maxSize > number of pages.
            return config;
          }
        },
        { provide: 'MockEngine', useValue: mockEngine },
        ReceiptValidatorDirective,
        TranslatorPipe,
        TranslateService,
        provideHttpClient(withInterceptorsFromDi()),
        provideAnimations()
    ]
}).then(moduleRef => {
    // Expose Angular stability status to Cypress
    const appRef = moduleRef.injector.get(ApplicationRef);
    (window as any).isAngularStable = () => appRef.isStable;
})
  .catch(err => console.error(err));
