import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from srcs.utils.markgraph.markgraph_parser import compile_markgraph, RedirLink

def test_button_in_table():
    mg = """# Test Scene
| Name | Action |
| --- | --- |
| Item 1 | [[Click Me](#target)] |
| Item 2 | [Link Me](#target) |
"""
    result = compile_markgraph(mg)
    scene = result.scenes[0]
    
    # Tables are currently merged into a single TextNode
    text_node = None
    for child in scene.children:
        if isinstance(child, getattr(sys.modules[RedirLink.__module__], 'TextNode')):
            text_node = child
            break
            
    assert text_node is not None
    print(f"Text Content:\n{text_node.markdown}")
    
    # Check fragments - Button in table should NOT be fragmented anymore.
    # It should be part of the string fragment as a standard link [Click Me](#target)
    table_fragment_found = False
    for f in text_node.fragments:
        if isinstance(f, str):
            print(f"String Fragment Found:\n{f}")
            if "| Item 1 | [Click Me](#target) |" in f:
                table_fragment_found = True
        elif isinstance(f, RedirLink):
            print(f"RedirLink(kind={f.kind}, label={f.label}, target={f.target})")
    
    assert table_fragment_found, "Table fragment with sanitized link not found in string fragments"
    print("SUCCESS: Buttons in tables are now kept within string fragments as standard links.")

    # Test 2: Button NOT in a table - Should still be fragmented
    mg2 = """# Test Scene 2
[[Normal Button](#target)]
"""
    result2 = compile_markgraph(mg2)
    scene2 = result2.scenes[0]
    button_node = scene2.children[0]
    
    button_found = False
    for f in button_node.fragments:
        if isinstance(f, RedirLink):
            print(f"RedirLink(kind={f.kind}, label={f.label}, target={f.target})")
            if f.label == "Normal Button":
                assert f.kind == "button", f"Expected 'button' for standalone button, got {f.kind}"
                button_found = True
    
    assert button_found, "Standalone button fragment not found (should be fragmented)"
    print("SUCCESS: Buttons NOT in tables are still correctly fragmented as 'button'.")

if __name__ == "__main__":
    test_button_in_table()
