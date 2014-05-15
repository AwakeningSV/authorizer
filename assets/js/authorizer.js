var animation_speed = 300;
var shake_speed = 600;



// Switch between option tabs.
function chooseTab(listName) {
  // default to the access list tab
  listName = typeof listName !== 'undefined' ? listName : 'access_list';

  // Hide all tab content, then show selected tab content
  jQuery('div.section_info, div.section_info + table').hide();
  jQuery('#section_info_' + listName + ', #section_info_' + listName + ' + table').show();

  // Set active tab
  jQuery('.nav-tab-wrapper a').removeClass('nav-tab-active');
  jQuery('a.nav-tab-' + listName).addClass('nav-tab-active');
}

// Add user to list (list = blocked or approved).
function auth_add_user(caller, list, create_local_account) {
  // default to the approved list
  list = typeof list !== 'undefined' ? list : 'approved';
  create_local_account = typeof create_local_account !== 'undefined' ? create_local_account : false;

  var username = jQuery(caller).parent().find('.auth-username');
  var email = jQuery(caller).parent().find('.auth-email');
  var role = jQuery(caller).parent().find('.auth-role');

  // Helper variable for disabling buttons while processing. This will be
  // set differently if our clicked button is nested in a div (below).
  var buttons = caller;

  // Button (caller) might be nested in a div, so we need to walk up one more level
  if ( username.length === 0 || email.length === 0 || role.length === 0 ) {
    username = jQuery(caller).parent().parent().find('.auth-username');
    email = jQuery(caller).parent().parent().find('.auth-email');
    role = jQuery(caller).parent().parent().find('.auth-role');
    buttons = jQuery(caller).parent().children();
  }

  var nextId = jQuery('#list_auth_settings_access_users_' + list + ' li').length;
  var validated = true;

  if (jQuery.trim(username.val()) == '')
    return false;

  jQuery(buttons).attr('disabled', 'disabled');

  // Check if the course being added already exists in the list.
  if (validated) {
    jQuery('#list_auth_settings_access_users_' + list + ' input.auth-username').each(function() {
      if (this.value == username.val()) {
        validated = false;
        jQuery(this).parent().effect('shake', shake_speed);
        jQuery(buttons).removeAttr('disabled');
        return false;
      }
    });
  }

  // Check if the name being added already exists in the list.
  if (validated) {
    jQuery('#list_auth_settings_access_users_' + list + ' input.auth-email').each(function() {
      if (this.value == email.val()) {
        validated = false;
        jQuery(this).parent().effect('shake', shake_speed);
        jQuery(buttons).removeAttr('disabled');
        return false;
      }
    });
  }

  if (validated) {
    // Add the new item.
    var local_icon = create_local_account ? '&nbsp;<a title="Local WordPress user" class="auth-local-user"><span class="glyphicon glyphicon-user"></span></a>' : '';
    jQuery(' \
      <li id="new_user_' + nextId + '" style="display: none;"> \
        <input type="text" name="auth_settings[access_users_' + list + '][' + nextId + '][username]" value="' + username.val() + '" readonly="true" class="auth-username" /> \
        <input type="text" id="auth_settings_access_users_' + list + '_' + nextId + '" name="auth_settings[access_users_' + list + '][' + nextId + '][email]" value="' + email.val() + '" readonly="true" class="auth-email" /> \
        <select name="auth_settings[access_users_' + list + '][' + nextId + '][role]" class="auth-role" onchange="save_auth_settings_access(this);"> \
        </select> \
        <input type="text" name="auth_settings[access_users_' + list + '][' + nextId + '][date_added]" value="' + getShortDate() + '" readonly="true" class="auth-date-added" /> \
        <input type="button" class="button" onclick="auth_ignore_user(this);" value="&times;" /> ' + local_icon + ' \
        <span class="spinner"></span> \
      </li> \
    ').appendTo('#list_auth_settings_access_users_' + list + '').slideDown(250);

    // Populate the role dropdown in the new element. Because clone() doesn't
    // save selected state on select elements, set that too.
    jQuery('option', role).clone().appendTo('#new_user_' + nextId + ' .auth-role');
    jQuery('#new_user_' + nextId + ' .auth-role').val(role.val());

    // Remove the 'empty list' item if it exists.
    jQuery('#list_auth_settings_access_users_' + list + ' li.auth-empty').remove();

    // Reset the new user textboxes
    username.val('');
    email.val('');
    jQuery(buttons).removeAttr('disabled');

    // Update the options in the database with this change.
    save_auth_settings_access(buttons, create_local_account);

    return true;
  }
}

// Remove user from list.
function auth_ignore_user(caller, listName) {
  // Show an 'empty list' message if we're deleting the last item
  listName = typeof listName !== 'undefined' ? listName : '';
  var list = jQuery(caller).parent().parent();
  if (jQuery('li', list).length <= 1) {
    jQuery(list).append('<li class="auth-empty"><em>No ' + listName + ' users</em></li>');
  }

  jQuery(caller).parent().slideUp(250,function() {
    // Remove the list item.
    jQuery(this).remove();

    // Update the options in the database with this change.
    save_auth_settings_access(caller);
  });
}



// Save options from dashboard widget.
function save_auth_settings_access(caller, create_local_account) {
  jQuery(caller).attr('disabled', 'disabled');
  jQuery(caller).last().after('<span class="spinner"></span>');
  jQuery('form .spinner').show();

  var access_restriction = jQuery('form input[name="auth_settings[access_restriction]"]:checked').val();

  var access_users_pending = new Object();
  jQuery('#list_auth_settings_access_users_pending li').each(function(index) {
    var user = new Object();
    user['username'] = jQuery('.auth-username', this).val();
    user['email'] = jQuery('.auth-email', this).val();
    user['role'] = jQuery('.auth-role', this).val();
    access_users_pending[index] = user;
  });

  var access_users_approved = new Object();
  jQuery('#list_auth_settings_access_users_approved li').each(function(index) {
    var user = new Object();
    user['username'] = jQuery('.auth-username', this).val();
    user['email'] = jQuery('.auth-email', this).val();
    user['role'] = jQuery('.auth-role', this).val();
    user['date_added'] = jQuery('.auth-date-added', this).val();
    user['local_user'] = jQuery('.auth-local-user', this).length !== 0;
    access_users_approved[index] = user;
  });

  // If admin clicked 'add local user', mark the last user in the list of approved
  // users as a local user (the last user is the user the admin just added).
  if ( create_local_account ) {
    access_users_approved[Object.keys(access_users_approved).length-1]['local_user'] = true;
  }

  var access_users_blocked = new Object();
  jQuery('#list_auth_settings_access_users_blocked li').each(function(index) {
    var user = new Object();
    user['username'] = jQuery('.auth-username', this).val();
    user['email'] = jQuery('.auth-email', this).val();
    user['role'] = jQuery('.auth-role', this).val();
    user['date_added'] = jQuery('.auth-date-added', this).val();
    access_users_blocked[index] = user;
  });

  var nonce_save_auth_settings_access = jQuery('#nonce_save_auth_settings_access').val();

  jQuery.post(ajaxurl, {
    action: 'save_auth_dashboard_widget',
    'access_restriction': access_restriction,
    'access_users_pending': access_users_pending,
    'access_users_approved': access_users_approved,
    'access_users_blocked': access_users_blocked,
    'nonce_save_auth_settings_access': nonce_save_auth_settings_access,
  }, function(response) {
    jQuery('form .spinner').remove();
    jQuery(caller).removeAttr('disabled');
    if (response==0) { // failed
      return false;
    } else { // succeeded
      return true;
    }
  });
}



// Helper function to grab a querystring param value by name
function getParameterByName(needle, haystack) {
  needle = needle.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
  var regexS = "[\\?&]" + needle + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(haystack);
  if(results == null)
    return "";
  else
    return decodeURIComponent(results[1].replace(/\+/g, " "));
}

// Helper function to generate a random string
function getRandomId() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i=0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

// Helper function to return a short date (e.g., Jul 2013) for today's date
function getShortDate(date) {
  date = typeof date !== 'undefined' ? date : new Date();
  var month = '';
  switch (date.getMonth()) {
    case 0: month = 'Jan'; break;
    case 1: month = 'Feb'; break;
    case 2: month = 'Mar'; break;
    case 3: month = 'Apr'; break;
    case 4: month = 'May'; break;
    case 5: month = 'Jun'; break;
    case 6: month = 'Jul'; break;
    case 7: month = 'Aug'; break;
    case 8: month = 'Sep'; break;
    case 9: month = 'Oct'; break;
    case 10: month = 'Nov'; break;
    case 11: month = 'Dec'; break;
  }
  return month + ' ' + date.getFullYear();
}

// Helper function to grab the TLD from a FQDN
function getTLDFromFQDN(fqdn) {
  fqdn = typeof fqdn !== 'undefined' ? fqdn : '';
  var matches = fqdn.match(/[^.]*\.[^.]*$/);
  return matches.length > 0 ? matches[0] : '';
}

// Helper function to get the username from an email address
function getUsernameFromEmail(email) {
  email = typeof email !== 'undefined' ? email : '';
  return email.split("@")[0];
}


jQuery(document).ready(function($){
  // Grab references to form elements that we will show/hide on page load
  var auth_settings_access_redirect_to_login = $('#radio_auth_settings_access_redirect_to_login').closest('tr');
  var auth_settings_access_redirect_to_message = $('#wp-auth_settings_access_redirect_to_message-wrap').closest('tr');
  var auth_settings_access_users_pending = $('#list_auth_settings_access_users_pending').closest('tr');
  var auth_settings_access_users_approved = $('#list_auth_settings_access_users_approved').closest('tr');
  var auth_settings_access_users_blocked = $('#list_auth_settings_access_users_blocked').closest('tr');
  var auth_settings_access_role_receive_pending_emails = $('#auth_settings_access_role_receive_pending_emails').closest('tr');
  var auth_settings_access_pending_redirect_to_message = $('#wp-auth_settings_access_pending_redirect_to_message-wrap').closest('tr');
  var auth_settings_access_public_pages = $('#auth_settings_access_public_pages').closest('tr');
  var auth_settings_external_settings_table = $('#auth_settings_external_service_cas').closest('table');
  var auth_settings_external_service_cas = $('#radio_auth_settings_external_service_cas').closest('tr');
  var auth_settings_external_cas_host = $('#auth_settings_cas_host').closest('tr');
  var auth_settings_external_cas_port = $('#auth_settings_cas_port').closest('tr');
  var auth_settings_external_cas_path = $('#auth_settings_cas_path').closest('tr');
  var auth_settings_external_ldap_host = $('#auth_settings_ldap_host').closest('tr');
  var auth_settings_external_ldap_port = $('#auth_settings_ldap_port').closest('tr');
  var auth_settings_external_ldap_search_base = $('#auth_settings_ldap_search_base').closest('tr');
  var auth_settings_external_ldap_uid = $('#auth_settings_ldap_uid').closest('tr');
  var auth_settings_external_ldap_user = $('#auth_settings_ldap_user').closest('tr');
  var auth_settings_external_ldap_password = $('#auth_settings_ldap_password').closest('tr');
  var auth_settings_external_ldap_tls = $('#auth_settings_ldap_tls').closest('tr');

  // Wrap the th and td in the rows above so we can animate their heights (can't animate tr heights with jquery)
  $('th, td', auth_settings_access_redirect_to_login).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_access_redirect_to_message).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_access_users_pending).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_access_users_approved).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_access_users_blocked).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_access_role_receive_pending_emails).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_access_pending_redirect_to_message).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_access_public_pages).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_cas_host).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_cas_port).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_cas_path).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_ldap_host).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_ldap_port).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_ldap_search_base).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_ldap_uid).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_ldap_user).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_ldap_password).wrapInner('<div class="animated_wrapper" />');
  $('th, td', auth_settings_external_ldap_tls).wrapInner('<div class="animated_wrapper" />');

  // If we're viewing the dashboard widget, reset a couple of the relevant
  // option variables (since they're aren't nested in table rows).
  if ($('#auth_dashboard_widget').length) {
    auth_settings_access_users_pending = $('#list_auth_settings_access_users_pending').closest('div');
    auth_settings_access_users_approved = $('#list_auth_settings_access_users_approved').closest('div');
    auth_settings_access_users_blocked = $('#list_auth_settings_access_users_blocked').closest('div');
    $(auth_settings_access_users_pending).wrapInner('<div class="animated_wrapper" />');
    $(auth_settings_access_users_approved).wrapInner('<div class="animated_wrapper" />');
    $(auth_settings_access_users_blocked).wrapInner('<div class="animated_wrapper" />');

    // Remove the helper link, since there are no tabs on the dashboard widget
    $('#dashboard_link_approved_users').contents().unwrap();
  }

  // On load: Show/hide pending/approved/blocked list options
  if (!$('#radio_auth_settings_access_restriction_approved_users').is(':checked')) {
    $('div.animated_wrapper', auth_settings_access_users_pending).hide();
    $('div.animated_wrapper', auth_settings_access_users_approved).hide();
    $('div.animated_wrapper', auth_settings_access_users_blocked).hide();
    $('div.animated_wrapper', auth_settings_access_role_receive_pending_emails).hide();
    $('div.animated_wrapper', auth_settings_access_pending_redirect_to_message).hide();
  }

  // On load: Show/hide CAS/LDAP options based on which is selected
  if ($('#radio_auth_settings_external_service_cas').is(':checked')) {
    $('div.animated_wrapper', auth_settings_external_ldap_host).hide();
    $('div.animated_wrapper', auth_settings_external_ldap_port).hide();
    $('div.animated_wrapper', auth_settings_external_ldap_search_base).hide();
    $('div.animated_wrapper', auth_settings_external_ldap_uid).hide();
    $('div.animated_wrapper', auth_settings_external_ldap_user).hide();
    $('div.animated_wrapper', auth_settings_external_ldap_password).hide();
    $('div.animated_wrapper', auth_settings_external_ldap_tls).hide();

    $('td, th', auth_settings_external_ldap_host).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_ldap_port).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_ldap_search_base).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_ldap_uid).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_ldap_user).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_ldap_password).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_ldap_tls).animate({ padding: '0px' }, { duration: animation_speed });
  } else {
    $('div.animated_wrapper', auth_settings_external_cas_host).hide();
    $('div.animated_wrapper', auth_settings_external_cas_port).hide();
    $('div.animated_wrapper', auth_settings_external_cas_path).hide();

    $('td, th', auth_settings_external_cas_host).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_cas_port).animate({ padding: '0px' }, { duration: animation_speed });
    $('td, th', auth_settings_external_cas_path).animate({ padding: '0px' }, { duration: animation_speed });
  }

  // Event handler: Hide "Handle unauthorized visitors" option if access is granted to "Everyone"
  $('input[name="auth_settings[access_restriction]"]').change(function(){
    if ($('#radio_auth_settings_access_restriction_everyone').is(':checked')) {
      $('div.animated_wrapper', auth_settings_access_redirect_to_login).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_access_redirect_to_message).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_access_public_pages).slideUp(animation_speed);
    } else {
      $('div.animated_wrapper', auth_settings_access_redirect_to_login).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_access_redirect_to_message).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_access_public_pages).slideDown(animation_speed);
      $('input[name="auth_settings[access_redirect]"]').trigger('change');
    }
  
    // Hide user whitelist unless "Only specific students below" is checked
    if (!$('#radio_auth_settings_access_restriction_approved_users').is(':checked')) {
      $('div.animated_wrapper', auth_settings_access_users_pending).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_access_users_approved).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_access_users_blocked).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_access_role_receive_pending_emails).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_access_pending_redirect_to_message).slideUp(animation_speed);
    } else {
      $('div.animated_wrapper', auth_settings_access_users_pending).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_access_users_approved).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_access_users_blocked).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_access_role_receive_pending_emails).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_access_pending_redirect_to_message).slideDown(animation_speed);
    }
  });

  // Event handler: show/hide CAS/LDAP options based on selection.
  $('input[name="auth_settings[external_service]"]').change(function() {
    if ($('#radio_auth_settings_external_service_cas').is(':checked')) {
      $('div.animated_wrapper', auth_settings_external_cas_host).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_cas_port).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_cas_path).slideDown(animation_speed);

      $('div.animated_wrapper', auth_settings_external_ldap_host).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_port).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_search_base).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_uid).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_user).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_password).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_tls).slideUp(animation_speed);

      $('th', auth_settings_external_cas_host).animate({ padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_cas_port).animate({ padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_cas_path).animate({ padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('td', auth_settings_external_cas_host).animate({ padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_cas_port).animate({ padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_cas_path).animate({ padding: '15px 10px' }, { duration: animation_speed });

      $('td, th', auth_settings_external_ldap_host).animate(       { padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_ldap_port).animate(       { padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_ldap_search_base).animate({ padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_ldap_uid).animate(        { padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_ldap_user).animate(       { padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_ldap_password).animate(   { padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_ldap_tls).animate(        { padding: '0px' }, { duration: animation_speed });
    } else {
      $('div.animated_wrapper', auth_settings_external_cas_host).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_cas_port).slideUp(animation_speed);
      $('div.animated_wrapper', auth_settings_external_cas_path).slideUp(animation_speed);

      $('div.animated_wrapper', auth_settings_external_ldap_host).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_port).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_search_base).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_uid).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_user).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_password).slideDown(animation_speed);
      $('div.animated_wrapper', auth_settings_external_ldap_tls).slideDown(animation_speed);

      $('td, th', auth_settings_external_cas_host).animate({ padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_cas_port).animate({ padding: '0px' }, { duration: animation_speed });
      $('td, th', auth_settings_external_cas_path).animate({ padding: '0px' }, { duration: animation_speed });

      $('th', auth_settings_external_ldap_host).animate(       { padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_ldap_port).animate(       { padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_ldap_search_base).animate({ padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_ldap_uid).animate(        { padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_ldap_user).animate(       { padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_ldap_password).animate(   { padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('th', auth_settings_external_ldap_tls).animate(        { padding: '20px 10px 20px 0' }, { duration: animation_speed });
      $('td', auth_settings_external_ldap_host).animate(       { padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_ldap_port).animate(       { padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_ldap_search_base).animate({ padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_ldap_uid).animate(        { padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_ldap_user).animate(       { padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_ldap_password).animate(   { padding: '15px 10px' }, { duration: animation_speed });
      $('td', auth_settings_external_ldap_tls).animate(        { padding: '15px 10px' }, { duration: animation_speed });
    }
  });

  // List management function: pressing enter in the username, email, or role
  // field adds the user to the list. Additionally, if the email field is
  // blank, it gets constructed from the username field (and vice versa).
  $('form input.auth-username, form input.auth-email, form select.auth-role').bind('keyup', function(e) {
    if (e.which == 13) { // Enter key
      $(this).parent().find('input[type="button"]').trigger('click');
      return false;
    } else if ($(this).hasClass('auth-username')) {
      $(this).siblings('.auth-email').val($(this).val() + '@' + getTLDFromFQDN($('#auth_settings_cas_host').val()));
    } else if ($(this).hasClass('auth-email')) {
      $(this).siblings('.auth-username').val(getUsernameFromEmail($(this).val()));
    }
  });
  $('form input.auth-username, form input.auth-email').bind('keydown', function(e) {
    if (e.which == 13) { // Enter key
      e.preventDefault();
      return false;
    }
  });

  // Enable the user-friendly multiselect form element on the options page.
  $('#auth_settings_access_public_pages').multiSelect({
    selectableOptgroup: true,
    selectableHeader: '<div class="custom-header">Private Pages</div>',
    selectionHeader: '<div class="custom-header">Public Pages</div>',
  });

  // Switch to the first tab.
  chooseTab('access_lists');

});


/**
 * Portions below from Bootstrap
 * http://getbootstrap.com/getting-started/#download
 */


/*!
 * Bootstrap v3.1.1 (http://getbootstrap.com)
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */

if (typeof jQuery === 'undefined') { throw new Error('Bootstrap\'s JavaScript requires jQuery') }

/* ========================================================================
 * Bootstrap: dropdown.js v3.1.1
 * http://getbootstrap.com/javascript/#dropdowns
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // DROPDOWN CLASS DEFINITION
  // =========================

  var backdrop = '.dropdown-backdrop'
  var toggle   = '[data-toggle=dropdown]'
  var Dropdown = function (element) {
    $(element).on('click.bs.dropdown', this.toggle)
  }

  Dropdown.prototype.toggle = function (e) {
    var $this = $(this)

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    clearMenus()

    if (!isActive) {
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
        // if mobile we use a backdrop because click events don't delegate
        $('<div class="dropdown-backdrop"/>').insertAfter($(this)).on('click', clearMenus)
      }

      var relatedTarget = { relatedTarget: this }
      $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $parent
        .toggleClass('open')
        .trigger('shown.bs.dropdown', relatedTarget)

      $this.focus()
    }

    return false
  }

  Dropdown.prototype.keydown = function (e) {
    if (!/(38|40|27)/.test(e.keyCode)) return

    var $this = $(this)

    e.preventDefault()
    e.stopPropagation()

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    if (!isActive || (isActive && e.keyCode == 27)) {
      if (e.which == 27) $parent.find(toggle).focus()
      return $this.click()
    }

    var desc = ' li:not(.divider):visible a'
    var $items = $parent.find('[role=menu]' + desc + ', [role=listbox]' + desc)

    if (!$items.length) return

    var index = $items.index($items.filter(':focus'))

    if (e.keyCode == 38 && index > 0)                 index--                        // up
    if (e.keyCode == 40 && index < $items.length - 1) index++                        // down
    if (!~index)                                      index = 0

    $items.eq(index).focus()
  }

  function clearMenus(e) {
    $(backdrop).remove()
    $(toggle).each(function () {
      var $parent = getParent($(this))
      var relatedTarget = { relatedTarget: this }
      if (!$parent.hasClass('open')) return
      $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))
      if (e.isDefaultPrevented()) return
      $parent.removeClass('open').trigger('hidden.bs.dropdown', relatedTarget)
    })
  }

  function getParent($this) {
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
    }

    var $parent = selector && $(selector)

    return $parent && $parent.length ? $parent : $this.parent()
  }


  // DROPDOWN PLUGIN DEFINITION
  // ==========================

  var old = $.fn.dropdown

  $.fn.dropdown = function (option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.dropdown')

      if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  $.fn.dropdown.Constructor = Dropdown


  // DROPDOWN NO CONFLICT
  // ====================

  $.fn.dropdown.noConflict = function () {
    $.fn.dropdown = old
    return this
  }


  // APPLY TO STANDARD DROPDOWN ELEMENTS
  // ===================================

  $(document)
    .on('click.bs.dropdown.data-api', clearMenus)
    .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })
    .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    .on('keydown.bs.dropdown.data-api', toggle + ', [role=menu], [role=listbox]', Dropdown.prototype.keydown)

}(jQuery);