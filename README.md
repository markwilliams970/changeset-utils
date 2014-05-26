changeset-utils
===============

Utility Apps and Scripts to Help With Rally Changesets / SCM Connectors

## Overview
Some handy Javascript Apps, and some Ruby Scripts to help work with Rally Changesets / SCM Connectors. See individual README's in Sub-Folders for more details.

* Apps:
* Artifact-Changeset-Helper
 * Javascript App to run inside Rally that lets you:
 * Create, Move, or Delete Changesets associated to a selected Rally Artifact
* Changeset-Mover
 * Javascript App to run inside Rally that lets you:
 * Query for all Changesets whose CommitTimestamp lies within a selected timerange
 * Move selected Changesets to a new Artifact, or, delete them
 * Helps with cleanup of errant commits/commit messages from a Rally SCM connector (Subversion, Git, Github, etc.)
* App Pre-requisites: Must be used in a Rally Workspace where Build/Changesets are enabled. Install as a Custom HTML App in Rally.
* Scripts:
 * create_changeset.rb
 * Interactive script to create a changeset from Ruby
 * clean_changeset.rb
 * Interactive script to delete a changeset from a Selected Rally Artifact, using Ruby
 * create_scm.rb
 * Interactive script to allow creation of a new SCM Repository in a Rally Workspace, using Ruby
* Script Requirements:
 * Ruby 1.9.3 or higher
 * rally_api 1.0 or higher

## License

These tools are released under the MIT license.  See the file [LICENSE](./LICENSE) for the full text.
