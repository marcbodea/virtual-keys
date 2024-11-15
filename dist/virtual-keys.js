import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

function humanSeconds(seconds) {
  return [
    [Math.floor(seconds / 31536000), "year"],
    [Math.floor((seconds % 31536000) / 86400), "day"],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), "hour"],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), "minute"],
    [(((seconds % 31536000) % 86400) % 3600) % 60, "second"],
  ]
    .map(([value, label]) => {
      return value > 0 ? `${value} ${label}${value !== 1 ? "s" : ""} ` : "";
    })
    .join(" ");
}

function differenceInMinutes(targetDateStr) {
  const now = new Date();
  const targetDate = new Date(targetDateStr);
  const diffInMilliseconds = targetDate - now;
  const diffInMinutes = Math.floor(diffInMilliseconds / 1000 / 60);
  return diffInMinutes;
}

class VirtualKeysPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
      route: { type: Object },
      panel: { type: Object },
      users: { type: Array },
      tokens: { type: Array },
      alert: { type: String },
    };
  }

  constructor() {
    super();
    this.users = [];
    this.tokens = [];
    this.dashboard = "dashboard-guest"; // Default dashboard
    this.alert = "";
    this.alertType = "";

    // form inputs
    this.name = null;
    this.user = null;
    this.expire = 0;
    this.expirationDate = "";
    this.datetimeLabel = "Expiration Date";
  }

  fetchUsers() {
    this.hass.callWS({ type: "virtual_keys/list_users" }).then((users) => {
      this.users = [];
      this.tokens = [];
      users
        .filter((user) => !user.system_generated && user.is_active)
        .forEach((user) => {
          this.users.push({
            id: user.id,
            name: user.name,
          });
          if (user.name === "guest") {
            this.user = user.id;
          }
          user.tokens
            .filter(
              (token) =>
                token.type === "long_lived_access_token" &&
                token.expiration !== 315360000
            )
            .forEach((token) => {
              this.tokens.push({
                id: token.id,
                name: token.name,
                user: user.name,
                jwt_token: token.jwt_token,
                expiration: token.expiration,
                remaining: token.remaining,
              });
            });
        });
    });
  }

  update(changedProperties) {
    if (changedProperties.has("hass") && this.hass) {
      this.fetchUsers();
    }
    super.update(changedProperties);
  }

  userChanged(e) {
    this.user = e.detail.value;
  }

  nameChanged(e) {
    this.name = e.target.value;
  }

  dashboardChanged(e) {
    this.dashboard = e.target.value;
  }

  expireChanged(e) {
    this.expire = e.target.value;
  }

  expirationDateChanged(e) {
    this.expirationDate = e.detail.value;
  }

  toggleSideBar() {
    this.dispatchEvent(
      new Event("hass-toggle-menu", { bubbles: true, composed: true })
    );
  }

  addClick() {
    this.hass
      .callWS({
        type: "virtual_keys/create_token",
        name: this.name,
        user_id: this.user,
        minutes: this.expire
          ? parseInt(this.expire, 10)
          : differenceInMinutes(this.expirationDate),
      })
      .then(() => {
        this.fetchUsers();
      })
      .catch((err) => {
        this.alertType = "warning";
        let messageDisplay = err.message;
        if (err.code === "invalid_format") {
          const errorMessage = err.message;
          messageDisplay = "Element(s) missing to create a token:";
          if (errorMessage.includes("name")) {
            messageDisplay += " an Name,";
          }
          if (errorMessage.includes("user_id")) {
            messageDisplay += " an User,";
          }
          if (errorMessage.includes("minutes")) {
            messageDisplay += " an Expiration,";
          }
          messageDisplay.slice(0, -1) + ".";
        }
        this.showAlert(messageDisplay);
      });
  }

  deleteButton() {
    return html`<svg
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      role="img"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
    >
      <g>
        <path
          d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
        ></path>
      </g>
    </svg>`;
  }

  showAlert(text) {
    this.alert = text;
    setTimeout(() => {
      this.alert = "";
    }, 2000);
  }

  deleteClick(e, token) {
    e.stopPropagation();

    this.hass
      .callWS({
        type: "virtual_keys/delete_token",
        token_id: token.id,
      })
      .then(() => {
        this.fetchUsers();
      })
      .catch((err) => {
        this.alertType = "warning";
        this.showAlert(err.message);
      });
  }

  getLoginUrl(token) {
    let url = `${this.hass.hassUrl()}local/community/virtual-keys/login.html?token=${
      token.jwt_token
    }`;
    if (this.dashboard) {
      url += `&dash=${this.dashboard}`;
    }
    return url;
  }

  listItemClick(e, token) {
    navigator.clipboard.writeText(this.getLoginUrl(token));
    this.alertType = "info";
    this.showAlert("Copied to clipboard " + token.name);
  }

  render() {
    return html`
      <div>
        <header class="mdc-top-app-bar mdc-top-app-bar--fixed">
          <div class="mdc-top-app-bar__row">
            <section
              class="mdc-top-app-bar__section mdc-top-app-bar__section--align-start"
              id="navigation"
            >
              <div>
                <mwc-icon-button
                  title="Sidebar Toggle"
                  @click=${this.toggleSideBar}
                >
                  <svg
                    preserveAspectRatio="xMidYMid meet"
                    focusable="false"
                    role="img"
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                  >
                    <g>
                      <path
                        class="primary-path"
                        d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"
                      ></path>
                    </g>
                  </svg>
                </mwc-icon-button>
              </div>

              <span class="mdc-top-app-bar__title"> ${this.panel.title} </span>
            </section>
            <section
              class="mdc-top-app-bar__section mdc-top-app-bar__section--align-end"
              id="actions"
              role="toolbar"
            >
              <slot name="actionItems"></slot>
            </section>
          </div>
        </header>

        <div class="mdc-top-app-bar--fixed-adjust flex content">
          <div class="filters">
            <ha-textfield
              label="Key name"
              value=""
              @input="${this.nameChanged}"
            ></ha-textfield>

            <ha-combo-box
              .items=${this.users}
              .itemLabelPath=${"name"}
              .itemValuePath=${"id"}
              .value=${this.user}
              .label=${"User"}
              @value-changed=${this.userChanged}
            >
            </ha-combo-box>
            <span>:</span>
            <ha-textfield
              label="Dashboard"
              .value=${this.dashboard}
              @input=${this.dashboardChanged}
            ></ha-textfield>
            <ha-textfield
              label="Expire (minutes)"
              type="number"
              value="${this.expire}"
              @input="${this.expireChanged}"
            ></ha-textfield>
            <span>or</span>
            <ha-selector
              .selector=${{
                datetime: {
                  mode: "both",
                },
              }}
              .label=${this.datetimeLabel}
              .hass=${this.hass}
              .required=${false}
              @value-changed=${this.expirationDateChanged}
            >
            </ha-selector>

            <mwc-button raised label="Add" @click=${this.addClick}></mwc-button>
          </div>

          ${this.alert.length
            ? html` <div class="container-alert">
                <ha-alert alert-type=${this.alertType}>
                  ${this.alert}
                </ha-alert>
              </div>`
            : ""}
          ${this.tokens.length
            ? html` <ha-card class="container-list">
                <mwc-list>
                  ${this.tokens.map(
                    (token) => html`
                      <mwc-list-item
                        hasMeta
                        twoline
                        @click=${(e) => this.listItemClick(e, token)}
                      >
                        <a href="${this.getLoginUrl(token)}">${token.name}</a>
                        <span slot="secondary"
                          >${token.user}, Expire:
                          ${humanSeconds(token.remaining)}</span
                        >
                        <mwc-icon
                          slot="meta"
                          @click=${(e) => this.deleteClick(e, token)}
                          >${this.deleteButton()}</mwc-icon
                        >
                      </mwc-list-item>
                    `
                  )}
                </mwc-list>
              </ha-card>`
            : null}
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      :host {
      }
      .mdc-top-app-bar {
        --mdc-typography-headline6-font-weight: 400;
        color: var(--app-header-text-color, var(--mdc-theme-on-primary, #fff));
        background-color: var(
          --app-header-background-color,
          var(--mdc-theme-primary)
        );
        width: var(--mdc-top-app-bar-width, 100%);
        display: flex;
        position: fixed;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
        width: 100%;
        z-index: 4;
      }
      .mdc-top-app-bar--fixed {
        transition: box-shadow 0.2s linear 0s;
      }
      .mdc-top-app-bar--fixed-adjust {
        padding-top: var(--header-height);
      }
      .mdc-top-app-bar__row {
        height: var(--header-height);
        border-bottom: var(--app-header-border-bottom);
        display: flex;
        position: relative;
        box-sizing: border-box;
        width: 100%;
        height: 64px;
      }
      .mdc-top-app-bar__section--align-start {
        justify-content: flex-start;
        order: -1;
      }
      .mdc-top-app-bar__section {
        display: inline-flex;
        flex: 1 1 auto;
        align-items: center;
        min-width: 0px;
        padding: 8px 12px;
        z-index: 1;
      }
      .mdc-top-app-bar__title {
        -webkit-font-smoothing: antialiased;
        font-family: var(
          --mdc-typography-headline6-font-family,
          var(--mdc-typography-font-family, Roboto, sans-serif)
        );
        font-size: var(--mdc-typography-headline6-font-size, 1.25rem);
        line-height: var(--mdc-typography-headline6-line-height, 2rem);
        font-weight: var(--mdc-typography-headline6-font-weight, 500);
        letter-spacing: var(
          --mdc-typography-headline6-letter-spacing,
          0.0125em
        );
        text-decoration: var(
          --mdc-typography-headline6-text-decoration,
          inherit
        );
        text-transform: var(--mdc-typography-headline6-text-transform, inherit);
        padding-left: 20px;
        padding-right: 0px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        z-index: 1;
      }

      app-header {
        background-color: var(--primary-color);
        color: var(--text-primary-color);
        font-weight: 400;
      }
      app-toolbar {
        height: var(--header-height);
      }
      app-toolbar [main-title] {
        margin-left: 20px;
      }
      ha-combo-box {
        padding: 8px 0;
        width: auto;
      }
      mwc-button {
        padding: 16px 0;
      }
      .content {
        padding-left: 16px;
        padding-right: 16px;
        padding-bottom: 16px;
      }
      .flex {
        flex: 1 1 1e-9px;
      }
      .filters {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        padding: 8px 16px 0px;
      }
      .filters > * {
        margin-right: 8px;
      }

      .container-alert {
        margin-top: 15px;
        padding: 0 2%;
      }

      .container-list {
        margin-top: 15px;
      }

      @media (min-width: 870px) {
        mwc-icon-button {
          display: none;
        }
      }
    `;
  }
}

customElements.define("virtual-keys-panel", VirtualKeysPanel);
