"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export default function VigenereSettings() {
  return (
    <div className="flex items-center justify-center p-10">
      <form>
        {/* Encrypted Profile Settings */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <h2 className="font-semibold text-foreground dark:text-foreground">
              Encrypted Profile
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground dark:text-muted-foreground">
              Your profile info is encrypted locally before storage or sending.
              Fields are optional and stored securely.
            </p>
          </div>
          <div className="sm:max-w-3xl md:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              {/* Username (Pseudonym) */}
              <div className="col-span-full sm:col-span-3">
                <Label
                  htmlFor="username"
                  className="text-sm font-medium text-foreground dark:text-foreground"
                >
                  Username
                </Label>
                <Input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="off"
                  placeholder="CrypticFox"
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  Pick any pseudonym. Not published or searchable—only contacts
                  see it, encrypted.
                </p>
              </div>
              {/* Profile Picture URL */}
              <div className="col-span-full sm:col-span-3">
                <Label
                  htmlFor="profile-pic"
                  className="text-sm font-medium text-foreground dark:text-foreground"
                >
                  Profile Picture URL (optional)
                </Label>
                <Input
                  type="url"
                  id="profile-pic"
                  name="profile-pic"
                  autoComplete="off"
                  placeholder="https://imgur.com/myicon.png"
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  Direct link only. This URL is stored encrypted, never
                  analyzed.
                </p>
              </div>
              {/* Bio */}
              <div className="col-span-full">
                <Label
                  htmlFor="bio"
                  className="text-sm font-medium text-foreground dark:text-foreground"
                >
                  Bio (optional)
                </Label>
                <Textarea
                  id="bio"
                  name="bio"
                  className="mt-2"
                  rows={3}
                  placeholder="Say something about yourself."
                />
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  Bio is stored encrypted. Only contacts can view if shared.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Separator className="my-8" />

        {/* Account Settings */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <h2 className="font-semibold text-foreground dark:text-foreground">
              Account
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground dark:text-muted-foreground">
              Your anonymous account number is stored locally. All
              authentication uses this secret.
            </p>
          </div>
          <div className="sm:max-w-3xl md:col-span-2">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label
                  htmlFor="account-number"
                  className="text-sm font-medium text-foreground dark:text-foreground"
                >
                  Account Number
                </Label>
                <Input
                  type="text"
                  id="account-number"
                  name="account-number"
                  autoComplete="off"
                  disabled
                  value={"************"} // Masked for privacy; display with reveal option
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  Write down or export your account number in a secure place.
                  Losing it means losing your account. Never share or publish.
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="whitespace-nowrap rounded-none"
                >
                  Export Account Backup
                </Button>
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  Export all encrypted account/session keys for backup. Requires
                  local PIN/password.
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="whitespace-nowrap rounded-none"
                >
                  Regenerate Profile Encryption Key
                </Button>
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  For advanced users: rotate profile encryption key. Contacts
                  will need latest link to view profile.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Separator className="my-8" />

        {/* Contact/Privacy Management */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <h2 className="font-semibold text-foreground dark:text-foreground">
              Contact Links & Privacy
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground dark:text-muted-foreground">
              Share your contact link for secure addition. You control who can
              add you, and can revoke links anytime.
            </p>
          </div>
          <div className="sm:max-w-3xl md:col-span-2">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="whitespace-nowrap rounded-none"
                >
                  Generate Contact Link
                </Button>
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  Generate new secure contact link. Share privately as QR or
                  URL.
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="whitespace-nowrap rounded-none"
                >
                  Revoke/Expire Contact Link
                </Button>
                <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  Instantly revoke old contact links if leaked or no longer
                  wanted.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Separator className="my-8" />

        {/* Notification & Session Settings */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <h2 className="font-semibold text-foreground dark:text-foreground">
              Notifications & Sessions
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground dark:text-muted-foreground">
              Control notifications and session privacy options.
            </p>
          </div>
          <div className="sm:max-w-3xl md:col-span-2">
            <fieldset>
              <legend className="text-sm font-medium text-foreground dark:text-foreground">
                In-app & Push Notifications
              </legend>
              <p
                id="notif-description"
                className="mt-2 text-sm leading-6 text-muted-foreground dark:text-muted-foreground"
              >
                Notification options are client-controlled; Vigenère never
                stores device tokens server-side.
              </p>
              <RadioGroup defaultValue="silent" className="mt-6">
                <div className="flex items-center gap-x-3">
                  <RadioGroupItem
                    id="all"
                    value="all"
                    aria-describedby="notif-description"
                  />
                  <Label
                    htmlFor="all"
                    className="text-sm font-medium text-foreground dark:text-foreground"
                  >
                    All messages
                  </Label>
                </div>
                <div className="flex items-center gap-x-3">
                  <RadioGroupItem
                    id="mentions"
                    value="mentions"
                    aria-describedby="notif-description"
                  />
                  <Label
                    htmlFor="mentions"
                    className="text-sm font-medium text-foreground dark:text-foreground"
                  >
                    Mentions only
                  </Label>
                </div>
                <div className="flex items-center gap-x-3">
                  <RadioGroupItem
                    id="silent"
                    value="silent"
                    aria-describedby="notif-description"
                  />
                  <Label
                    htmlFor="silent"
                    className="text-sm font-medium text-foreground dark:text-foreground"
                  >
                    Silent
                  </Label>
                </div>
              </RadioGroup>
            </fieldset>
            <div className="mt-8">
              <Button
                type="button"
                variant="outline"
                className="whitespace-nowrap rounded-none"
              >
                Clear Local Encrypted Data
              </Button>
              <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
                Remove all local keys, sessions, and profiles from this device
                (irreversible).
              </p>
            </div>
          </div>
        </div>
        <Separator className="my-8" />

        {/* Save Button */}
        <div className="flex items-center justify-end space-x-4">
          <Button
            type="reset"
            variant="outline"
            className="whitespace-nowrap rounded-none"
          >
            Reset
          </Button>
          <Button type="submit" className="whitespace-nowrap rounded-none">
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
