require 'rally_api'
require 'date'
require 'time'

# Load (and maybe override with) my personal/private variables from a file...
my_vars= File.dirname(__FILE__) + "/my_vars2.rb"
if FileTest.exist?( my_vars ); print "Loading <#{my_vars}>...\n"; require my_vars end

#==================== Making a connection to Rally ====================#
puts "Connecting to Rally: #{$my_base_url} as #{$my_username}..."

$headers                                        = RallyAPI::CustomHttpHeader.new()
$headers.name                           = "Create SCMRepo"
$headers.vendor                         = "KateT"
$headers.version                         = "Alpha"
$my_headers                                = $headers

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

scm_repo_create= @rally.create(:SCMRepository, fields)
puts scm_repo_create["Name"  ]