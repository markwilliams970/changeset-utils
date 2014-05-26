require 'rally_api'
require 'date'
require 'time'

# Load (and maybe override with) my personal/private variables from a file...
my_vars= File.dirname(__FILE__) + "/my_vars.rb"
if FileTest.exist?( my_vars ); print "Loading <#{my_vars}>...\n"; require my_vars end

#==================== Making a connection to Rally ====================#
puts "Connecting to Rally: #{$my_base_url} as #{$my_username}..."

$headers                = RallyAPI::CustomHttpHeader.new()
$headers.name           = "Create SCMRepo"
$headers.vendor         = "Rally Labs"
$headers.version        = "0.50"
$my_headers             = $headers

config                  = {:base_url => $my_base_url}
config[:username]       = $my_username
config[:password]       = $my_password
config[:workspace]      = $my_workspace
config[:project]        = $my_project
config[:version]        = $my_api_version
config[:headers]        = $my_headers #from RallyAPI::CustomHttpHeader.new()


@rally = RallyAPI::RallyRestJson.new(config)

puts "Now connected to Rally."

#==================== Creating an SCM Repository ====================
fields = {}
fields["Name"] = "SCMRepo"
fields["Description"] = "My SCMRepository"
fields["Uri"] = "https://somerepo.company.com:8080"
fields["SCMType"] = "git"

# Ask user for Artifact Formatted ID
puts "Please enter a name for the SCM Repository to create:"
puts
scm_repo_name = [(print 'Enter Name: '), gets.rstrip][1]

puts "Please enter a brief Description for the SCM Repository:"
puts
scm_repo_desc = [(print 'Enter Description: '), gets.rstrip][1]

puts "Please enter a URL for the SCM Repository (i.e. https://websvn.company.com:8080):"
puts
scm_repo_uri = [(print 'Enter URL: '), gets.rstrip][1]

puts "Please enter a Type for the SCM Repository (i.e. Git, SVN, etc.):"
puts
scm_repo_type = [(print 'Enter Type: '), gets.rstrip][1]

if scm_repo_name.nil? || scm_repo_desc.nil? || scm_repo_uri.nil? || scm_repo_type.nil? then
  puts "Missing required entry! Will exit."
end

fields["Name"]        = scm_repo_name
fields["Description"] = scm_repo_desc
fields["Uri"]         = scm_repo_uri
fields["SCMType"]     = scm_repo_type

begin
  scm_repo_create = @rally.create(:SCMRepository, fields)
  puts "Successfully Created #{scm_repo_name}."
rescue => ex
  puts "Error occurred trying to create: #{scm_repo_name}."
  puts ex
  puts ex.msg
  puts ex.backtrace
end

puts "Complete!"