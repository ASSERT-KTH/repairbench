// src/components/LeaderboardTable.js
import React, { useState, useEffect } from 'react';
import { useTable, useSortBy } from 'react-table';
import ReactCountryFlag from "react-country-flag";
import './LeaderboardTable.css'; // Add some basic CSS styling

// LLM to country code mapping
const llmCountryMap = {
  'gemini-1.5-pro': 'US',
  'gpt-4o-2024-08-06': 'US',
  // Add more mappings as needed
};

const LeaderboardTable = () => {
  const [data, setData] = useState([]);

  // Function to load data from JSON files
  const loadData = async () => {
    const llmNames = [['gemini-1.5-pro', "google"], ['gpt-4o-2024-08-06', "openai-chatcompletion"]]; // Add more LLM names as required
    const benchmarks = ['defects4j', 'gitbugjava']; // Add more benchmarks if available
    const metrics = ['exact_match@1', 'ast_match@1', 'plausible@1'];

    let results = [];
    for (const llm of llmNames) {
      const llm_name = llm[0];
      const strategy = llm[1];
      const row = { name: llm_name };

      for (const benchmark of benchmarks) {
        try {
          const response = await fetch(`./results/${llm_name}/${benchmark}/statistics_${benchmark}_instruct_${strategy}.json`);
          const result = await response.json();
          metrics.forEach(metric => {
            row[`${benchmark}_${metric}`] = result[metric];
          });
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

  useEffect(() => {
    loadData();
  }, []);

  // Define columns for the table
  const columns = React.useMemo(
    () => {
      const bestScores = getBestScores(data);

      const createColumn = (header, accessor, benchmark) => ({
        Header: header,
        accessor: accessor,
        Cell: ({ value }) => (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: value === bestScores[accessor] ? 'bold' : 'normal' }}>
              {formatPercentage(value)}
            </span>
          </div>
        )
      });

      return [
        {
          Header: 'LLM',
          accessor: 'name',
          Cell: ({ value }) => (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <ReactCountryFlag
                countryCode={llmCountryMap[value] || 'UN'}
                svg
                style={{ marginRight: '10px' }}
              />
              {value}
            </div>
          )
        },
        {
          Header: 'Defects4J',
          columns: [
            createColumn('Exact Match @1', 'defects4j_exact_match@1', 'defects4j'),
            createColumn('AST Match @1', 'defects4j_ast_match@1', 'defects4j'),
            createColumn('Plausible @1', 'defects4j_plausible@1', 'defects4j'),
          ],
        },
        {
          Header: 'GitBug-Java',
          columns: [
            createColumn('Exact Match @1', 'gitbugjava_exact_match@1', 'gitbugjava'),
            createColumn('AST Match @1', 'gitbugjava_ast_match@1', 'gitbugjava'),
            createColumn('Plausible @1', 'gitbugjava_plausible@1', 'gitbugjava'),
          ],
        },
      ];
    },
    [data]
  );

  // Create the table instance
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    { columns, data },
    useSortBy
  );

  return (
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
  );
};

export default LeaderboardTable;
