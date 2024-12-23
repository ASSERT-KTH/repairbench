import json
import os
from collections import defaultdict

def load_model_data():
    model_file = os.path.join(os.path.dirname(__file__), '..', 'models.json')
    with open(model_file, 'r') as f:
        data = json.load(f)
        return data['models'], data['countryMap']

def load_data(results_dir):
    data = []
    model_list, llm_country_map = load_model_data()
    benchmarks = ['defects4j', 'gitbugjava']
    metrics = ['ast_match@1', 'plausible@1']

    for llm_name, strategy, provider in model_list:
        row = {'name': llm_name, 'provider': provider, 'total_cost': None}

        try:
            with open(f"{results_dir}/{llm_name}/total.json") as f:
                total_result = json.load(f)
                row['total_ast_match@1'] = total_result.get('ast_match@1', None)
                row['total_plausible@1'] = total_result.get('plausible@1', None)
                row['total_cost'] = total_result.get('cost', None)
        except FileNotFoundError:
            print(f"Warning: total.json not found for {llm_name}")
            row['total_ast_match@1'] = None
            row['total_plausible@1'] = None

        all_benchmarks_complete = True
        for benchmark in benchmarks:
            try:
                with open(f"{results_dir}/{llm_name}/{benchmark}/statistics_{benchmark}_instruct_{strategy}.json") as f:
                    stats_result = json.load(f)
                    for metric in metrics:
                        row[f"{benchmark}_{metric}"] = stats_result.get(metric, None)

                with open(f"{results_dir}/{llm_name}/{benchmark}/costs_{benchmark}_instruct_{strategy}.json") as f:
                    cost_result = json.load(f)
                    row[f"{benchmark}_cost"] = cost_result.get('total_cost', None)
            except FileNotFoundError:
                print(f"Warning: Data not found for {llm_name} - {benchmark}")
                for metric in metrics:
                    row[f"{benchmark}_{metric}"] = None
                row[f"{benchmark}_cost"] = None
                all_benchmarks_complete = False

        # Only compute total cost if all benchmarks are complete and there's no total.json
        if all_benchmarks_complete and row['total_cost'] is None:
            row['total_cost'] = sum(row[f"{benchmark}_cost"] for benchmark in benchmarks if row[f"{benchmark}_cost"] is not None)

        data.append(row)

    return data, model_list, llm_country_map

def find_best_scores(data):
    best_scores = defaultdict(lambda: -float('inf'))
    for row in data:
        for key, value in row.items():
            if key.endswith('ast_match@1') or key.endswith('plausible@1'):
                if value is not None and value > best_scores[key]:
                    best_scores[key] = value
    return best_scores

def load_citations():
    citations_file = os.path.join(os.path.dirname(__file__), '..', 'citations.json')
    with open(citations_file, 'r') as f:
        return json.load(f)

def generate_latex_table(data, model_list, llm_country_map):
    best_scores = find_best_scores(data)
    citations = load_citations()
    
    latex = "\\begin{table*}[t]\n"
    latex += "\\centering\n"
    latex += "\\makebox[\\textwidth][c]{%\n"
    latex += "\\resizebox{1.3\\textwidth}{!}{\n"
    latex += "\\large\n"
    latex += "\\begin{tabular}{@{}ll "

    # Modify each S column to include detect-weight=true
    s_columns = [
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=4.2, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=4.2, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=2.1, detect-weight=true]",
        "S[table-format=4.2, detect-weight=true]",
        "c"  # Add a column for Ref.
    ]
    latex += ' '.join(s_columns) + "@{}}\n"
    
    latex += "\\toprule\n"
    latex += "\\multirow{2}{*}{\\textbf{Organization}} & \\multirow{2}{*}{\\textbf{Model}} & \\multicolumn{3}{c}{Defects4J v2 (484 bugs)} & \\multicolumn{3}{c}{GitBug-Java (90 bugs)} & \\multicolumn{3}{c}{\\textbf{Total (574 bugs)}} & \\multirow{2}{*}{Ref.} \\\\\n"
    latex += "\\cmidrule(lr){3-5} \\cmidrule(lr){6-8} \\cmidrule(l){9-11}\n"
    latex += " & & {Plausible@1} & {AST Match@1} & {Cost (\\$)} & {Plausible@1} & {AST Match@1} & {Cost (\\$)} & {\\textbf{Plausible@1}\\textsuperscript{1}} & {\\textbf{AST Match@1}} & {\\textbf{Cost (\\$)}} & \\\\\n"
    latex += "\\midrule\n"

    partial_footnote_needed = False  # Flag to check if footnote is required

    # Sort data: rows with total results first, then by total_plausible@1 score
    sorted_data = sorted(data, 
                         key=lambda x: (x['total_plausible@1'] is not None, 
                                        x['total_plausible@1'] if x['total_plausible@1'] is not None else -1),
                         reverse=True)

    for row in sorted_data:
        has_incomplete_results = any(row[f"{benchmark}_{metric}"] is None 
                                     for benchmark in ['defects4j', 'gitbugjava'] 
                                     for metric in ['ast_match@1', 'plausible@1'])
        
        if has_incomplete_results:
            suffix = "\\textsuperscript{2}"
            partial_footnote_needed = True  # Set flag to add footnote later
        else:
            suffix = ""

        # Get the model name and citation
        model_name = row['name']
        citation_key = citations.get(model_name, '')
        
        # Get the country code for the provider
        country_code = llm_country_map.get(row['provider'], 'UN')  # 'UN' for unknown
        
        # Insert the flag using the flag-icon package
        provider_with_flag = f"\\worldflag[width=0.3cm]{{{country_code}}} {row['provider']}"
        
        # Start building the LaTeX row with suffix appended
        latex += f"{provider_with_flag}{suffix} & {model_name}{suffix} & "
        
        for benchmark in ['defects4j', 'gitbugjava', 'total']:
            for metric in ['plausible@1', 'ast_match@1']:
                key = f"{benchmark}_{metric}"
                value = row[key]
                if value is not None:
                    if value == best_scores[key]:
                        cell = f"\\B {value*100:.1f}\\%"
                    else:
                        cell = f"{value*100:.1f}\\%"
                else:
                    cell = f"\\multicolumn{{1}}{{c}}{{---}}"
                latex += f"{cell} & "
            
            cost = row[f'{benchmark}_cost']
            if cost is not None:
                cell = f"\\${cost:.2f}"
            else:
                cell = f"\\multicolumn{{1}}{{c}}{{---}}"
            
            latex += f"{cell} & "

        # Add the citation to the end of the row
        latex += f"\\citep{{{citation_key}}}" if citation_key else "---"
        latex += " \\\\\n"

    latex += "\\bottomrule\n"
    # Add the footnote once after all rows
    latex += "\\addlinespace\n"
    latex += f"\\multicolumn{{12}}{{l}}{{\\textsuperscript{{1}}Models are sorted by the total Plausible@1 score.}} \\\\\n"
    if partial_footnote_needed:
        latex += f"\\multicolumn{{12}}{{l}}{{\\textsuperscript{{2}}Only partial results available right now due to cost reasons.}} \\\\\n"
    latex += "\\addlinespace\n"
    latex += "\\end{tabular}\n"
    latex += "}\n"
    latex += "}\n"
    latex += "\\caption{Leaderboard of Frontier Models for Program Repair as of \\today}\n"
    latex += "\\label{tab:leaderboard}\n"
    latex += "\\end{table*}\n"

    return latex

def main():
    results_dir = os.path.join(os.path.dirname(__file__), '..', 'results')
    data, model_list, llm_country_map = load_data(results_dir)
    latex_table = generate_latex_table(data, model_list, llm_country_map)

    print(latex_table)
    

if __name__ == "__main__":
    main()
