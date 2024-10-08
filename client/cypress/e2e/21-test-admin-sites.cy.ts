describe("admin configure, add, and delete tenants", () => {
  const add_tenant = async (name:string) => {
    cy.get(".show-add-tenant-btn").click();
    cy.get("[name='newTenant.name']").type(name);
    cy.get("#add-btn").click();
    cy.contains(name).should("exist");
  };

  it("should add new tenant", () => {
    cy.login_admin();
    cy.visit("/#/admin/sites");

    add_tenant("Platform A");
    add_tenant("Platform B");
    add_tenant("Platform C");

    cy.takeScreenshot("admin/sites_management_sites");

    cy.get("#delete_tenant").last().click();
    cy.get("#modal-action-ok").click();

    cy.get('[data-cy="options"]').click();
    cy.takeScreenshot("admin/sites_management_options");
    cy.logout();
  });
});
