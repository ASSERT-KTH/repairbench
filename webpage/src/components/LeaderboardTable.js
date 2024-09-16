// src/components/LeaderboardTable.js
import React, { useState, useEffect } from 'react';
import { useTable, useSortBy } from 'react-table';
import ReactCountryFlag from "react-country-flag";
import CitationBox from './CitationBox'; // Import the new component
import Footer from './Footer'; // Import the Footer component
import './LeaderboardTable.css'; // Add some basic CSS styling

// LLM to country code mapping
const llmCountryMap = {
  'Google': 'US',
  'OpenAI': 'US',
  // Add more mappings as needed
};

const LeaderboardTable = () => {
  const [data, setData] = useState([]);

  // Function to load data from JSON files
  const loadData = async () => {
    const llmNames = [
      ['gemini-1.5-pro', "google", "Google"],
      ['gpt-4o-2024-08-06', "openai-chatcompletion", "OpenAI"],
      ['o1-preview-2024-09-12', "openai-chatcompletion", "OpenAI"],
    ]; // Add more LLM names as required
    const benchmarks = ['defects4j', 'gitbugjava']; // Add more benchmarks if available
    const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1'];

    let results = [];
    for (const llm of llmNames) {
      const llm_name = llm[0];
      const strategy = llm[1];
      const provider = llm[2];
      const row = { name: llm_name, provider: provider, total_cost: 0 };

      for (const benchmark of benchmarks) {
        try {
          const stats_response = await fetch(`./results/${llm_name}/${benchmark}/statistics_${benchmark}_instruct_${strategy}.json`);
          const stats_result = await stats_response.json();
          metrics.forEach(metric => {
            row[`${benchmark}_${metric}`] = stats_result[metric];
          });
          // Add the total_cost from each benchmark
          const cost_response = await fetch(`./results/${llm_name}/${benchmark}/costs_${benchmark}_instruct_${strategy}.json`);
          const cost_result = await cost_response.json();
          row.total_cost += cost_result.total_cost || 0;
        } catch (error) {
          console.error(`Failed to load data for ${llm_name} - ${benchmark}:`, error);
        }
      }
      results.push(row);
    }
    setData(results);
  };

  // Function to find the best score for each metric
  const getBestScores = (data) => {
    const bestScores = {};
    const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1'];
    const benchmarks = ['defects4j', 'gitbugjava'];

    benchmarks.forEach(benchmark => {
      metrics.forEach(metric => {
        const key = `${benchmark}_${metric}`;
        bestScores[key] = Math.max(...data.map(row => row[key] || 0));
      });
    });

    return bestScores;
  };

  // Helper function to format number as percentage
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return (value * 100).toFixed(1).replace('.', ',') + '%';
  };

  // Helper function to format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Define columns for the table
  const columns = React.useMemo(
    () => {
      const bestScores = getBestScores(data);

      const createColumn = (header, accessor, format = formatPercentage) => ({
        Header: header,
        accessor: accessor,
        Cell: ({ value }) => (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: value === bestScores[accessor] ? 'bold' : 'normal' }}>
              {format(value)}
            </span>
          </div>
        )
      });

      return [
        {
          Header: 'Provider',
          accessor: 'provider',
          Cell: ({ value }) => (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <ReactCountryFlag
                countryCode={llmCountryMap[value] || 'UN'}
                svg
                style={{ marginRight: '10px' }}
              />
              <span style={{ fontWeight: 'bold' }}>{value}</span>
            </div>
          )
        },
        {
          Header: 'Model',
          accessor: 'name',
        },
        {
          Header: 'Defects4J',
          columns: [
            createColumn('AST Match @1', 'defects4j_ast_match@1'),
            createColumn('Plausible @1', 'defects4j_plausible@1'),
          ],
        },
        {
          Header: 'GitBug-Java',
          columns: [
            createColumn('AST Match @1', 'gitbugjava_ast_match@1'),
            createColumn('Plausible @1', 'gitbugjava_plausible@1'),
          ],
        },
        {
          Header: 'Total',
          columns: [
            createColumn('AST Match @1', 'total_ast_match@1'),
            createColumn('Plausible @1', 'total_plausible@1'),
            createColumn('Cost', 'total_cost', formatCurrency),
          ],
        }
      ];
    },
    [data]
  );

  // Create the table instance
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { 
      columns, 
      data,
      initialState: {
        sortBy: [
          { id: 'total_plausible@1', desc: true },
        ]
      }
    },
    useSortBy
  );

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-table-container">
        <table {...getTableProps()} className="leaderboard-table">
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                    {column.render('Header')}
                    <span>
                      {column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(row => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CitationBox /> {/* Add the CitationBox component here */}
      <Footer /> {/* Add the Footer component here */}
    </div>
  );
};

export default LeaderboardTable;
