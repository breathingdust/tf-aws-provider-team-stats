const core = require('@actions/core');
const github = require('@actions/github');

async function main(){
    const token = core.getInput('token');
    const org = core.getInput('org');
    const teamSlug = core.getInput('team_slug');

    const octokit = github.getOctokit(token);

    const membersResponse = await octokit.teams.listMembersInOrg({
        org: org,
        team_slug: teamSlug
    });

    core.info(`Found ${membersResponse.data.length} AWS team members.`)
    
    const searchQueries = membersResponse.data.map(async member => {
            const response = await octokit.search.issuesAndPullRequests({
                q : `is:pr is:open author:${member.login} draft:false org:${org}`
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

    core.setOutput("stats", JSON.stringify(searchResults));

    let stats_message = `Open Pull Requests for ${org}/${teamSlug}: `

    searchResults.map(member => stats_message+= `${member.member} ${member.count} `);

    core.setOutput("stats_message",stats_message);
}

try{
    main();
} catch (error) {
    core.setFailed(error.message);
}