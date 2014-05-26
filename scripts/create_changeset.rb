# Copyright 2002-2013 Rally Software Development Corp. All Rights Reserved.
#
# This script is open source and is provided on an as-is basis. Rally provides
# no official support for nor guarantee of the functionality, usability, or
# effectiveness of this code, nor its suitability for any application that
# an end-user might have in mind. Use at your own risk: user assumes any and
# all risk associated with use and implementation of this script in his or
# her own environment.

# Usage: ruby create_changeset.rb
# Specify the User-Defined variables below. Script will find target artifact
# and create a Changeset on it with specified attributes

require 'rally_api'
require 'date'
require 'time'

$my_base_url        = "https://rally1.rallydev.com/slm"
$my_username        = "user@company.com"
$my_password        = "password"
$my_workspace       = "My Workspace"
$my_project         = "My Project"
$project_scope_down = true
$wsapi_version      = "1.43"
$my_author          = "user@company.com"
$my_scm_url         = "https://svnrepo.company.com:8080"
$my_scm_repo        = "My Repository"

# Do not make changes to code below this line!!!
################################################

# Load (and maybe override with) my personal/private variables from a file...
my_vars= File.dirname(__FILE__) + "/my_vars.rb"
if FileTest.exist?( my_vars ) then require my_vars end

# Ask user for Artifact Formatted ID
puts "Please enter FormattedID of Artifact on which to create Changeset."
puts
artifact_formatted_id = [(print 'Enter Formatted ID: '), gets.rstrip][1].upcase

# Perform error checking
artifact_type = artifact_formatted_id[/[A-Z]+/]
start_number = artifact_formatted_id[/\d+/]

if artifact_type.nil? or start_number.nil? then
  puts "Invalid FormattedID. Please use the format DE1234. Exiting."
  exit
end

start_number_int = start_number.to_i

# Valid Artifact Types.
standard_types = ["US", "DE", "TA", "TC"]
valid_types = standard_types

artifact_type_match = valid_types.include? artifact_type

if artifact_type_match === false then
  puts "Invalid artifact type specified in Formatted ID."
  puts "Valid Formatted ID Prefix types include:"
  puts "#{valid_types}."
  puts "Exiting."
  exit
end

valid_query_types = {
    "US" => :hierarchicalrequirement,
    "DE" => :defect,
    "TA" => :task,
    "TC" => :testcase,
}
query_type = valid_query_types[artifact_type]

puts "Connecting to Rally: #{$my_base_url} as #{$my_username}..."
#==================== Make a connection to Rally ====================

#Setting custom headers
$headers                            = RallyAPI::CustomHttpHeader.new()
$headers.name                       = "Ruby Rally Changeset Creator"
$headers.vendor                     = "Rally Labs"
$headers.version                    = "0.50"
$my_headers                         = $headers

config                  = {:base_url => $my_base_url}
config[:username]       = $my_username
config[:password]       = $my_password
config[:workspace]      = $my_workspace
config[:project]        = $my_project
config[:version]        = $wsapi_version
config[:headers]        = $my_headers #from RallyAPI::CustomHttpHeader.new()

@rally = RallyAPI::RallyRestJson.new(config)

puts "Successfully connected to Rally."
puts "Querying for: #{query_type}s..."

query_string = "(FormattedID = #{start_number})"

# Lookup source artifact for changeset
scm_repo_query = RallyAPI::RallyQuery.new()
scm_repo_query.type = query_type
scm_repo_query.fetch = "ObjectID,FormattedID,Name,Changesets"
scm_repo_query.order = "FormattedID Asc"
scm_repo_query.project_scope_down = $project_scope_down
scm_repo_query.query_string = query_string

artifact_query_results = @rally.find(scm_repo_query)

number_of_artifacts = artifact_query_results.total_result_count

if number_of_artifacts == 0
  puts "No artifacts found matching FormattedID: #{artifact_formatted_id}. Exiting."
  exit
end

found_artifact = artifact_query_results.first
puts "Found #{number_of_artifacts} artifacts for possible changeset creation."

# Lookup SCM Repo
scm_repo_query = RallyAPI::RallyQuery.new()
scm_repo_query.type = :scmrepository
scm_repo_query.fetch = "ObjectID,Name,SCMType"
scm_repo_query.order = "CreationDate Asc"
scm_repo_query.project_scope_down = $project_scope_down
scm_repo_query.query_string = "(Name = \"#{$my_scm_repo}\")"

scm_repo_results = @rally.find(scm_repo_query)
number_of_repos = scm_repo_results.total_result_count

if number_of_repos == 0
  puts "No SCM Repos found matching Name: #{$my_scm_repo}. Exiting."
  exit
end

changeset_scm_repo = scm_repo_results.first

# Lookup Author
author_query = RallyAPI::RallyQuery.new()
author_query.type = :user
author_query.fetch = "ObjectID,UserName,DisplayName"
author_query.order = "UserName Asc"
author_query.project_scope_down = $project_scope_down
author_query.query_string = "(UserName = \"#{$my_author}\")"

author_results = @rally.find(author_query)
number_of_authors = author_results.total_result_count

if number_of_authors == 0
  puts "No Authors found matching UserName: #{$my_author}. Exiting."
  exit
end

changeset_author = author_results.first

puts "Start processing changeset..."

# Ask user for Changeset Data
puts "Please enter Changeset Revision: "
changeset_revision = [(print 'Enter Revision: '), gets.rstrip][1]

puts "Please enter the Commit Message: "
changeset_message = [(print 'Enter Message: '), gets.rstrip][1]

new_changeset = {}
new_changeset["Author"] = changeset_author
new_changeset["Revision"] = changeset_revision
new_changeset["Uri"] = $my_scm_url
new_changeset["SCMRepository"] = changeset_scm_repo
new_changeset["Message"] = changeset_message
new_changeset["CommitTimestamp"] = Time.now.utc.iso8601
new_changeset["Artifacts"] = [found_artifact]

create_result = @rally.create(:changeset, new_changeset)

puts
puts "Created a changeset: #{create_result}"
puts "Complete!"