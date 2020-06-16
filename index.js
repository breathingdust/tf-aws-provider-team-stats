const core = require('@actions/core');
const github = require('@actions/github');

async function main(){
    const token = core.getInput('token');
    let octokit = github.getOctokit(token);
        
    let membersResponse = await octokit.teams.listMembersInOrg({
        org: "terraform-providers",
        team_slug: "aws-provider"
    });

    core.info(`Found ${membersResponse.data.length} memmbers`)
    
    const searchQueries = membersResponse.data.map(async member => {
            const response = await octokit.search.issuesAndPullRequests({
                q : `is:pr is:open author:${member.login} draft:false org:terraform-providers`
            });

            const result = {
                member: member.login,
                count: response.data.total_count,
            }
            return result;
        }
    );

    const searchResults = await Promise.all(searchQueries);

    searchResults.sort(function(a, b) {
        var nameA = a.member.toUpperCase();
        var nameB = b.member.toUpperCase();
        return (nameA < nameB) ? -1 : (nameA > nameB) ? 1 : 0;
    });  

    core.setOutput("stats",JSON.stringify(searchResults));
}

try{
    main();
} catch (error) {
    core.setFailed(error.message);
}