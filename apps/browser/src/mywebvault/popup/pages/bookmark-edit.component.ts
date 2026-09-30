import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  SelectModule,
  ToastService,
} from "@bitwarden/components";
import { AddEditFolderDialogComponent } from "@bitwarden/vault";

import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { Bookmark, normalizeUrl, parseTags } from "../../bookmarks/bookmark";
import { BookmarkService } from "../bookmark.service";

/** No folder. bit-select needs a non-null value for this option. */
const NO_FOLDER = "";

/**
 * Add or edit one bookmark.
 * /bookmark?id=<id> edits; /bookmark?url=...&title=... adds, pre-filled (e.g. from the current tab).
 */
@Component({
  selector: "mwv-bookmark-edit",
  templateUrl: "./bookmark-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    FormFieldModule,
    SelectModule,
    ButtonModule,
    IconButtonModule,
    LinkModule,
    AsyncActionsModule,
  ],
})
export class BookmarkEditComponent implements OnInit {
  private readonly bookmarkService = inject(BookmarkService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  protected readonly NO_FOLDER = NO_FOLDER;
  protected readonly folders$ = this.bookmarkService.folders$;
  protected readonly editingId = signal<string | null>(null);
  private readonly existing = signal<Bookmark | undefined>(undefined);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ["", Validators.required],
    url: ["", Validators.required],
    folderId: [NO_FOLDER],
    tags: [""],
    notes: [""],
  });

  async ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const id = params.get("id");
    if (id) {
      const existing = await this.bookmarkService.get(id);
      this.existing.set(existing);
      if (!existing) {
        await this.router.navigate(["/tabs/vault"]);
        return;
      }
      this.editingId.set(id);
      this.form.setValue({
        title: existing.title,
        url: existing.url,
        folderId: existing.folderId ?? NO_FOLDER,
        tags: existing.tags.join(", "),
        notes: existing.notes,
      });
    } else {
      this.form.patchValue({ url: params.get("url") ?? "", title: params.get("title") ?? "" });
    }
  }

  protected newFolder() {
    AddEditFolderDialogComponent.open(this.dialogService);
  }

  readonly submit = async () => {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const url = normalizeUrl(value.url);
    try {
      new URL(url);
    } catch {
      this.form.controls.url.setErrors({
        invalidUrl: { message: this.i18nService.t("invalidUrl") },
      });
      return;
    }

    try {
      await this.bookmarkService.save({
        id: this.existing()?.id,
        title: value.title,
        url,
        folderId: value.folderId || null,
        tags: parseTags(value.tags),
        notes: value.notes,
        favorite: this.existing()?.favorite ?? false,
      });
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("bookmarkSaved"),
      });
      await this.router.navigate(["/tabs/vault"]);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  };

  readonly delete = async () => {
    const id = this.editingId();
    if (!id) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteBookmark" },
      content: { key: "deleteBookmarkConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await this.bookmarkService.delete(id);
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("bookmarkDeleted"),
    });
    await this.router.navigate(["/tabs/vault"]);
  };
}
