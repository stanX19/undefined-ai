from srcs.utils.markgraph.markgraph_parser import compile_markgraph, get_section_range

test_mg = """# Root Scene
## Section A
Some content A

## Section B
Some content B
:::quiz
Question?
- Answer *
:::

## Section C
Some content C
"""

result = compile_markgraph(test_mg)
all_nodes = []
def walk(node):
    if hasattr(node, "children"):
        all_nodes.append(node)
        for child in node.children:
            walk(child)

for s in result.scenes:
    walk(s)

print("Nodes found:")
for node in all_nodes:
    print(f"Type: {type(node)}, Line: {node.line}, raw_heading: '{node.raw_heading}', id: '{node.id}'")

range_a = get_section_range(test_mg, "Section A")
print(f"Range A: {range_a}")
