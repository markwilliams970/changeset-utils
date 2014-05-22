changeset-utils
===============

Some Simple SCM and Changeset Utilities for Rally.

Requirements:

 - Ruby 1.9.3 or higher
 - rally_api 1.0 or higher


clean_changeset.rb
==========================

Utility for listing Changesets associated with a specified Rally Artifact, selected by FormattedID.
User may delete selected Changesets from the Artifact, if Changesets are present.
Note: Deletion is permanent! Changesets deleted via this method cannot be recovered.
 
create_changeset.rb
================================

This script allows the user to create a Changeset associated to a Rally Artifact, selected by FormattedID.
The user is prompted to enter a Revision Number and Commit Message. Other parameters, such as SCM Repo and
the SCM URL, are specified in the my_vars.rb file

create_scm.rb
================================

This script allows the user to create an SCM Repo in a Workspace as specified in the my_vars.rb file.
The user is prompted to enter the SCM name, description, URL, and type.

Note! Build and Changesets must be enabled on the target workspace in order for the create to succeed. This can
be done by a Rally Subscription or Workspace Administrator.

Requirements:

 - Ruby 1.9.3 or higher
 - rally_api 1.0 or higher