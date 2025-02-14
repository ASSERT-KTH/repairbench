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
        row = {
            'name': llm_name, 
            'provider': provider, 
            'total_cost': None,
            'total_prompt_tokens': None,
            'total_completion_tokens': None,
            'total_tokens': None
        }

        try:
            with open(f"{results_dir}/{llm_name}/total.json") as f:
                total_result = json.load(f)
                row['total_ast_match@1'] = total_result.get('ast_match@1', None)
                row['total_plausible@1'] = total_result.get('plausible@1', None)
                row['total_cost'] = total_result.get('cost', None)
                row['total_prompt_tokens'] = total_result.get('prompt_tokens', None)
                row['total_completion_tokens'] = total_result.get('completion_tokens', None)
                row['total_tokens'] = total_result.get('total_tokens', None)
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

                with open(f"{results_dir}/{llm_name}/{benchmark}/usage_{benchmark}_instruct_{strategy}.json") as f:
                    usage_result = json.load(f)
                    row[f"{benchmark}_cost"] = usage_result.get('total_cost', None)
                    row[f"{benchmark}_prompt_tokens"] = usage_result.get('prompt_tokens', None)
                    row[f"{benchmark}_completion_tokens"] = usage_result.get('completion_tokens', None)
                    row[f"{benchmark}_total_tokens"] = usage_result.get('total_tokens', None)
            except FileNotFoundError:
                print(f"Warning: Data not found for {llm_name} - {benchmark}")
                for metric in metrics:
                    row[f"{benchmark}_{metric}"] = None
                row[f"{benchmark}_cost"] = None
                row[f"{benchmark}_prompt_tokens"] = None
                row[f"{benchmark}_completion_tokens"] = None
                row[f"{benchmark}_total_tokens"] = None
                all_benchmarks_complete = False

        # Only compute totals if all benchmarks are complete and there's no total.json
        if all_benchmarks_complete and row['total_cost'] is None:
            row['total_cost'] = sum(row[f"{benchmark}_cost"] for benchmark in benchmarks if row[f"{benchmark}_cost"] is not None)
            row['total_prompt_tokens'] = sum(row[f"{benchmark}_prompt_tokens"] for benchmark in benchmarks if row[f"{benchmark}_prompt_tokens"] is not None)
            row['total_completion_tokens'] = sum(row[f"{benchmark}_completion_tokens"] for benchmark in benchmarks if row[f"{benchmark}_completion_tokens"] is not None)
            row['total_tokens'] = sum(row[f"{benchmark}_total_tokens"] for benchmark in benchmarks if row[f"{benchmark}_total_tokens"] is not None)

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
    latex += "\\resizebox{1.3\\textwidth}{!}{\n"  # Reduced back to 1.3 since token columns are removed
    latex += "\\large\n"
    latex += "\\begin{tabular}{@{}ll "

    # S columns for all numeric values
    s_columns = [
        "S[table-format=2.1, detect-weight=true]",  # Plausible@1
        "S[table-format=2.1, detect-weight=true]",  # AST Match@1
        "S[table-format=4.2, detect-weight=true]"   # Cost
    ] * 3  # For each benchmark section and total
    s_columns.append("c")  # For Ref. column
    latex += ' '.join(s_columns) + "@{}}\n"
    
    latex += "\\toprule\n"
    latex += "\\multirow{3}{*}{\\textbf{Organization}} & \\multirow{3}{*}{\\textbf{Model}} & \\multicolumn{3}{c}{Defects4J v2 (484 bugs)} & \\multicolumn{3}{c}{GitBug-Java (90 bugs)} & \\multicolumn{3}{c}{\\textbf{Total (574 bugs)}} & \\multirow{3}{*}{Ref.} \\\\\n"
    latex += "\\cmidrule(lr){3-5} \\cmidrule(lr){6-8} \\cmidrule(l){9-11}\n"
    latex += " & & \\multicolumn{2}{c}{Score} & {Cost} & \\multicolumn{2}{c}{Score} & {Cost} & \\multicolumn{2}{c}{Score} & {\\textbf{Cost}} & \\\\\n"
    latex += "\\cmidrule(lr){3-4} \\cmidrule(lr){5-5} \\cmidrule(lr){6-7} \\cmidrule(lr){8-8} \\cmidrule(lr){9-10} \\cmidrule(lr){11-11}\n"
    latex += " & & {Plausible} & {AST} & {\\$} & {Plausible} & {AST} & {\\$} & {\\textbf{Plausible}} & {\\textbf{AST}} & {\\textbf{\\$}} & \\\\\n"
    latex += "\\midrule\n"

    partial_footnote_needed = False

    sorted_data = sorted(data, 
                        key=lambda x: (x['total_plausible@1'] is not None, 
                                    x['total_plausible@1'] if x['total_plausible@1'] is not None else -1),
                        reverse=True)

    for row in sorted_data:
        has_incomplete_results = any(row[f"{benchmark}_{metric}"] is None 
                                   for benchmark in ['defects4j', 'gitbugjava'] 
                                   for metric in ['ast_match@1', 'plausible@1'])
        
        suffix = "\\textsuperscript{2}" if has_incomplete_results else ""
        partial_footnote_needed = partial_footnote_needed or has_incomplete_results

        model_name = row['name']
        citation_key = citations.get(model_name, '')
        country_code = llm_country_map.get(row['provider'], 'UN')
        
        provider_with_flag = f"\\worldflag[length=0.5cm, width=0.3cm]{{{country_code}}} {row['provider']}"
        
        latex += f"{provider_with_flag}{suffix} & {model_name}{suffix} & "
        
        for benchmark in ['defects4j', 'gitbugjava', 'total']:
            # Add scores
            for metric in ['plausible@1', 'ast_match@1']:
                key = f"{benchmark}_{metric}"
                value = row[key]
                if value is not None:
                    cell = f"\\B {value*100:.1f}" if value == best_scores[key] else f"{value*100:.1f}"
                else:
                    cell = f"\\multicolumn{{1}}{{c}}{{---}}"
                latex += f"{cell} & "

            # Add cost
            cost = row[f'{benchmark}_cost']
            if cost is not None:
                cell = f"{cost:.2f}"
            else:
                cell = f"\\multicolumn{{1}}{{c}}{{---}}"
            latex += f"{cell} & "
        
        # Add citation
        latex += f"\\citep{{{citation_key}}}" if citation_key else "---"
        latex += " \\\\\n"

    latex += "\\bottomrule\n"
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
