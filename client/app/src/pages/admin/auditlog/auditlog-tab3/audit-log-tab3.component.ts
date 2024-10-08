import {Component, OnInit} from "@angular/core";
import {UtilsService} from "@app/shared/services/utils.service";
import {TipsResolver} from "@app/shared/resolvers/tips.resolver";
import {tipsResolverModel} from "@app/models/resolvers/tips-resolver-model";
import {AppDataService} from "@app/app-data.service";

@Component({
  selector: "src-auditlog-tab3",
  templateUrl: "./audit-log-tab3.component.html"
})
export class AuditLogTab3Component implements OnInit {
  currentPage = 1;
  pageSize = 20;
  tips: tipsResolverModel[] = [];

  constructor(private tipsResolver: TipsResolver, protected utilsService: UtilsService, protected appDataService: AppDataService) {
  }

  ngOnInit() {
    this.loadAuditLogData();
  }

  loadAuditLogData() {
    if (Array.isArray(this.tipsResolver.dataModel)) {
      this.tips = this.tipsResolver.dataModel;
    } else {
      this.tips = [this.tipsResolver.dataModel];
    }
  }

  getPaginatedData(): tipsResolverModel[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.tips.slice(startIndex, endIndex);
  }

  exportAuditLog() {
    this.utilsService.generateCSV(JSON.stringify(this.tips), "reports", ["id", "progressive", "creation_date", "last_update", "expiration_date", "context_id", "status", "substatus", "tor", "comments", "files", "receiver_count", "last_access"]);
  }
}