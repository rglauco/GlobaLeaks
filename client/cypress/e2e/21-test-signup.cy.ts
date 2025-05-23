describe("Admin Enable Signup", function() {
  it("should enable signup", function() {
    cy.login_admin();

    cy.visit("/#/admin/sites");
    cy.get('[data-cy="options"]').should('be.visible').click();
    cy.get('input[name="rootdomain"]').type("domain.tld");
    cy.get('input[name="enable_signup"]').click();
    cy.get('input[name="signup_tos1_enable"]').click();
    cy.get('input[name="signup_tos1_title"]').type("Terms and Conditions");
    cy.get('input[name="signup_tos1_checkbox_label"]').type("I've ready and I accept the [Terms and Conditions](https://www.globaleaks.org)");
    cy.takeScreenshot("admin/signup_configuration");
    cy.get('i.fa-solid.fa-check').click();

    cy.logout();
  });
});

describe("User Perform Signup", function() {
  it("should perform signup", function() {
    cy.visit("/#/");

    cy.takeScreenshot("admin/signup_form");

    cy.get('input[name="subdomain"]').type("test");
    cy.get('input[name="name"]').type("Name");
    cy.get('input[name="surname"]').type("Surname");
    cy.get('input[name="mail_address"]').type("test@example.net");
    cy.get('input[name="email"]').type("test@example.net");
    cy.get(".ButtonNext").click();
    cy.get(".title").should("be.visible");
  });
});

describe("Admin Disable Signup", function() {
  it("should disable signup", function() {
    cy.visit("/#/login");
    cy.login_admin();

    cy.visit("/#/admin/sites");
    cy.get('[data-cy="options"]').click();
    cy.get('input[name="enable_signup"]').click();
    cy.get('i.fa-solid.fa-check').click();

    cy.logout();
    cy.waitForUrl("/#/login")
    cy.visit("/#/");

  });
});
