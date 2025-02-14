const fs = require('fs');
const path = require('path');

function parseModelList() {
    const modelsJsonContent = fs.readFileSync(path.join(__dirname, '../../models.json'), 'utf8');
    const modelConfig = JSON.parse(modelsJsonContent);
    return modelConfig.models;
}

async function generateStaticData() {
  const benchmarks = ['defects4j', 'gitbugjava'];
  const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1', 'cost', 'prompt_tokens', 'completion_tokens', 'total_tokens'];
  let bugCounts = {};
  let totalBugs = 0;
  let results = [];

  try {
    // Get model list from models.json
    const modelList = parseModelList();

    // Read release dates
    const releaseDates = JSON.parse(fs.readFileSync(path.join(__dirname, '../../results/release_dates.json'), 'utf8'));

    for (const [llm_name, strategy, provider] of modelList) {
      const row = { 
        name: llm_name, 
        provider, 
        total_cost: null,
        total_prompt_tokens: 'N/A',
        total_completion_tokens: 'N/A',
        total_tokens: 'N/A',
        hasTotalData: false, 
        release_date: null 
      };

      try {
        // Try to read total.json
        const totalPath = path.join(__dirname, `../../results/${llm_name}/total.json`);
        if (fs.existsSync(totalPath)) {
          const totalResult = JSON.parse(fs.readFileSync(totalPath, 'utf8'));
          row['total_ast_match@1'] = totalResult['ast_match@1'];
          row['total_plausible@1'] = totalResult['plausible@1'];
          row.hasTotalData = true;
        }

        let allBenchmarksComplete = true;
        
        // Process each benchmark
        for (const benchmark of benchmarks) {
          const statsPath = path.join(__dirname, `../../results/${llm_name}/${benchmark}/statistics_${benchmark}_instruct_${strategy}.json`);
          const usagePath = path.join(__dirname, `../../results/${llm_name}/${benchmark}/usage_${benchmark}_instruct_${strategy}.json`);

          if (fs.existsSync(statsPath)) {
            const statsResult = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
            metrics.forEach(metric => {
              if (metric !== 'cost' && !metric.includes('tokens')) {
                row[`${benchmark}_${metric}`] = statsResult[metric];
              }
            });

            // Update bug count for each benchmark
            if (!bugCounts[benchmark]) {
              bugCounts[benchmark] = statsResult.num_bugs_with_prompt;
              totalBugs += statsResult.num_bugs_with_prompt;
            }
          } else {
            allBenchmarksComplete = false;
          }

          if (fs.existsSync(usagePath)) {
            const usageResult = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
            row[`${benchmark}_cost`] = usageResult.total_cost || null;
            row[`${benchmark}_prompt_tokens`] = usageResult.prompt_tokens || 'N/A';
            row[`${benchmark}_completion_tokens`] = usageResult.completion_tokens || 'N/A';
            row[`${benchmark}_total_tokens`] = usageResult.total_tokens || 'N/A';
          } else {
            allBenchmarksComplete = false;
          }
        }

        // Set release date
        row['release_date'] = releaseDates[llm_name];

        // Only compute totals if all benchmarks are complete and there's no total.json
        if (allBenchmarksComplete && row.hasTotalData) {
          row.total_cost = benchmarks.reduce((sum, benchmark) => sum + (row[`${benchmark}_cost`] || 0), 0);
          row.total_prompt_tokens = benchmarks.reduce((sum, benchmark) => sum + (row[`${benchmark}_prompt_tokens`] !== 'N/A' ? row[`${benchmark}_prompt_tokens`] : 0), 0);
          row.total_completion_tokens = benchmarks.reduce((sum, benchmark) => sum + (row[`${benchmark}_completion_tokens`] !== 'N/A' ? row[`${benchmark}_completion_tokens`] : 0), 0);
          row.total_tokens = benchmarks.reduce((sum, benchmark) => sum + (row[`${benchmark}_total_tokens`] !== 'N/A' ? row[`${benchmark}_total_tokens`] : 0), 0);
        }

      } catch (error) {
        console.error(`Error processing ${llm_name}:`, error);
      }

      results.push(row);
    }

    // Write the generated data
    const outputData = {
      results,
      bugCounts: { ...bugCounts, total: totalBugs }
    };

    const outputDir = path.join(__dirname, '../src/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'leaderboard-data.json'),
      JSON.stringify(outputData, null, 2)
    );

    console.log('Static data generated successfully!');

  } catch (error) {
    console.error('Failed to generate static data:', error);
    process.exit(1);
  }
}

generateStaticData();