"use strict";

/**
 * Contact
 *
 * API: Contact
 *
 * ctx: Context object contains request parameters
 *
 * @description: Contact stores contact details like address, email, phone, etc of an individual or an organization or of a user in the system.
 */
const { sanitizeEntity } = require("strapi-utils"); // removes private fields and its relations from model
const vm = require("vm");
module.exports = {
  /**
   * Method: find
   * Parameters:
   *    - Request object
   *      - Filters / Column attributes (Optional)
   * @description: This method returns all the contact details by default or specific contact details based on the filters passed to the method.
   */
  find: async (ctx) => {
    try {
      // ctx.query._q: filter parameters in context object
      let contact;
      if (ctx.query._q) {
        // checks if any filter parameter is present
        contact = await strapi.query("contact", "crm-plugin").search(ctx.query);
      } else {
        // returns all data if no filter parameter is passed
        contact = await strapi.query("contact", "crm-plugin").find(ctx.query);
      }
      return contact.map((entity) =>
        sanitizeEntity(entity, {
          model: strapi.plugins["crm-plugin"].models["contact"],
        })
      );
    } catch (error) {
      return ctx.badRequest(null, error.message);
    }
  },

  /**
   * Method: findOne
   * Parameters:
   *    - Request object
   *      - id - identifier of contact table
   * @description: This method returns specific contact details based on the id passed.
   */
  findOne: async (ctx) => {
    const { id } = ctx.params; // get id from context object
    try {
      const entity = await strapi
        .query("contact", "crm-plugin")
        .findOne({ id });
      // returns contact obj
      return sanitizeEntity(entity, {
        model: strapi.plugins["crm-plugin"].models["contact"],
      });
    } catch (error) {
      return ctx.badRequest(null, error.message);
    }
  },

  /**
   * Method: create
   * Parameters:
   *    - Request object
   *      - name - name of the individual or organization or user in the system
   *      - contact_type - type of contact (values : organization/individual)
   *      - Column attributes (Optional)
   * @description: This method creates a contact with the attribute parameters passed to this method by default. It returns details of the created contact.
   */
  create: async (ctx) => {
    let org;
    let contact;
    let idDetails = {};
    try {
      const requiredValues = ["name", "contact_type"];
      const result = strapi.plugins["crm-plugin"].services.utils.checkParams(
        ctx.request.body,
        requiredValues
      );
      // returns error message if required params not found/ empty params passed
      if (result.error == true) {
        return ctx.send(result.message);
      }
      // creates an entry in address table
      if (ctx.request.body.addresses && ctx.request.body.addresses.length > 0) {
        const addresses = await Promise.all(
          ctx.request.body.addresses.map((address) => {
            return strapi.query("address", "crm-plugin").create(address);
          })
        );
        delete ctx.request.body.addresses;
        idDetails["addresses"] = addresses.map((addr) => addr.id);
      }
      // creates an entry in organization/individual table
      if (ctx.request.body.contact_type == "individual") {
        org = await strapi
          .query("individual", "crm-plugin")
          .create(ctx.request.body);
        idDetails["individual"] = org.id;
      }
      if (ctx.request.body.contact_type == "organization") {
        org = await strapi
          .query("organization", "crm-plugin")
          .create(ctx.request.body);
        idDetails["organization"] = org.id;
      }

      // creates an entry into organization table with organization details
      let allDetails = Object.assign(idDetails, ctx.request.body);

      // creates an entry in contact table when required parameters are passed
      contact = await strapi.query("contact", "crm-plugin").create(allDetails);

      // returns created contact obj
      return sanitizeEntity(contact, {
        model: strapi.plugins["crm-plugin"].models.contact,
      });
    } catch (error) {
      return ctx.badRequest(null, error.message);
    }
  },

  /**
   * Method: update
   * Parameters:
   *    - Request object
   *      - id - identifier of contact table
   *      - Column attributes
   * @description: This method updates the specific contact based on the id with attribute parameters passed to it. It returns details of the updated contact.
   */
  update: async (ctx) => {
    let org;
    let contact;

    try {
      let contactDetails = {};
      contactDetails["contact"] = ctx.params.id;
      // checking whether address param passed in request object
      if (ctx.request.body.addresses && ctx.request.body.addresses.length > 0) {
        // checking if resp. contact has address
        let contactData = await strapi
          .query("contact", "crm-plugin")
          .findOne({ id: ctx.params.id });
        if (contactData.addresses && contactData.addresses.length > 0) {
          // Update query fired if address already present
          await Promise.all(
            ctx.request.body.addresses.map((addr) => {
              const params = { id: addr.id };
              return strapi.query("address", "crm-plugin").update(params, addr);
            })
          );
          delete ctx.request.body.addresses;
        } else {
          // Create query fired if address not present
          const addresses = await Promise.all(
            ctx.request.body.addresses.map((address) => {
              return strapi.query("address", "crm-plugin").create(address);
            })
          );
          delete ctx.request.body.addresses;
          ctx.request.body.addresses = addresses.map((addr) => addr.id);
        }
      }
      // updates organization/individual details according to the passed id
      if (ctx.request.body.contact_type == "individual")
        org = await strapi
          .query("individual", "crm-plugin")
          .update(contactDetails, ctx.request.body);

      if (ctx.request.body.contact_type == "organization")
        org = await strapi
          .query("organization", "crm-plugin")
          .update(contactDetails, ctx.request.body);
      // updates contact details for particular id according to parameters passed
      contact = await strapi
        .query("contact", "crm-plugin")
        .update(ctx.params, ctx.request.body);
      // return updated contact obj
      return sanitizeEntity(contact, {
        model: strapi.plugins["crm-plugin"].models.contact,
      });
    } catch (error) {
      return ctx.badRequest(null, error.message);
    }
  },

  /**
   * Method: delete
   * Parameters:
   *    - Request object
   *      - id - identifier of contact table
   * @description: This method deletes specific contact based on the id passed and returns details of the deleted contact.
   */
  delete: async (ctx) => {
    try {
      const contact = await strapi
        .query("contact", "crm-plugin")
        .delete(ctx.params);
      // gets contact type id of respective contact
      let orgId = contact.individual
        ? contact.individual.id
        : contact.organization
        ? contact.organization.id
        : "";
      // gets address details
      let addIds =
        contact.addresses && contact.addresses.length > 0
          ? contact.addresses.map((addr) => addr.id)
          : [];
      // delete contact details based on the passed id.
      if (orgId)
        await strapi
          .query(contact.contact_type, "crm-plugin")
          .delete({ id: orgId });
      // deletes address obj on id passes
      if (addIds.length > 0) {
        await Promise.all(
          addIds.map((addId) => {
            return strapi.query("address", "crm-plugin").delete({ id: addId });
          })
        );
      }

      await strapi
        .query("contacttag", "crm-plugin")
        .delete({ contact: ctx.params.id });
      // deletes contact obj based on id passed
      await strapi
        .query("activityassignee", "crm-plugin")
        .delete({ contact: ctx.params.id });
      // returns deleted contact obj
      return sanitizeEntity(contact, {
        model: strapi.plugins["crm-plugin"].models.contact,
      });
    } catch (error) {
      return ctx.badRequest(null, error.message);
    }
  },
};
