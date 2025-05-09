import {Component, Input, OnInit, inject} from "@angular/core";
import {NgForm, FormsModule} from "@angular/forms";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {Constants} from "@app/shared/constants/constants";
import {EnableEncryptionComponent} from "@app/shared/modals/enable-encryption/enable-encryption.component";
import {NodeResolver} from "@app/shared/resolvers/node.resolver";
import {PreferenceResolver} from "@app/shared/resolvers/preference.resolver";
import {QuestionnairesResolver} from "@app/shared/resolvers/questionnaires.resolver";
import {UsersResolver} from "@app/shared/resolvers/users.resolver";
import {UtilsService} from "@app/shared/services/utils.service";
import {AppConfigService} from "@app/services/root/app-config.service";
import {AuthenticationService} from "@app/services/helper/authentication.service";
import {userResolverModel} from "@app/models/resolvers/user-resolver-model";
import {questionnaireResolverModel} from "@app/models/resolvers/questionnaire-model";
import {NgClass} from "@angular/common";
import {TranslatorPipe} from "@app/shared/pipes/translate";
import {TranslateModule} from "@ngx-translate/core";
import {Subscription} from "rxjs";

@Component({
    selector: "src-tab5",
    templateUrl: "./tab5.component.html",
    standalone: true,
    imports: [FormsModule, NgClass, TranslatorPipe, TranslateModule]
})
export class Tab5Component implements OnInit {
  private authenticationService = inject(AuthenticationService);
  private modalService = inject(NgbModal);
  private appConfigService = inject(AppConfigService);
  private utilsService = inject(UtilsService);
  protected nodeResolver = inject(NodeResolver);
  protected preferenceResolver = inject(PreferenceResolver);
  private usersResolver = inject(UsersResolver);
  private questionnairesResolver = inject(QuestionnairesResolver);

  @Input() contentForm: NgForm;
  userData: userResolverModel[] = [];
  questionnaireData: questionnaireResolverModel[];
  routeReload = false;
  private userDataSubscription: Subscription;

  protected readonly Constants = Constants;

  ngOnInit(): void {
    this.filterUserData();

    this.questionnaireData = this.questionnairesResolver.dataModel;
  }

  filterUserData(): void {
    this.userData = this.usersResolver.dataModel.filter((user: { escrow: boolean }) => user.escrow);
  }

  ngOnDestroy(): void {
    if (this.userDataSubscription) {
      this.userDataSubscription.unsubscribe();
    }
  }

  enableEncryption() {
    const node = this.nodeResolver.dataModel;
    node.encryption = false;
    const modalRef = this.modalService.open(EnableEncryptionComponent, { backdrop: 'static', keyboard: false });
    modalRef.result.then(() => {
      this.utilsService.runAdminOperation("enable_encryption", {}, false).subscribe(() => {
        this.authenticationService.logout();
      });
    });
  }

  toggleEscrow(escrow: { checked: boolean }) {
    escrow.checked = this.nodeResolver.dataModel.escrow = !this.nodeResolver.dataModel.escrow;
    this.utilsService.runAdminOperation("toggle_escrow", {}, false).subscribe(() => {
      this.nodeResolver.dataModel.escrow = !this.nodeResolver.dataModel.escrow;
      this.usersResolver.refresh().subscribe(() => {
        this.filterUserData();
      });
    });
  }

  updateNode() {
    this.utilsService.update(this.nodeResolver.dataModel).subscribe(_ => {
      this.appConfigService.reinit();
      if (this.routeReload) {
        this.utilsService.reloadCurrentRoute();
      } else {
        this.utilsService.reloadComponent();
      }
    });
  }

  resetSubmissions() {
    this.utilsService.deleteDialog();
  }

  enableRouteReload() {
    this.routeReload = true;
  }
}

