"use client";

/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { useGraphAnimation } from "./useGraphAnimation";
import LeftSidebar from "./graphStudio/LeftSidebar";
import GraphCanvas from "./graphStudio/GraphCanvas";
import TimelinePanel from "./graphStudio/TimelinePanel";
import PropertyPanel from "./graphStudio/PropertyPanel";
// HUDPalette moved into the left Tools sidebar (controls relocated)
// import HUDPalette from './graphStudio/HUDPalette';
import { computeStepDiff, normalizeTimelinePayload } from "./graphStudio/graphStudioUtils";
import { EDGE_ROUTING } from "./graphStudio/constants";
import { DEFAULT_SCRIPT } from "./graphStudio/data/defaultScript";
import { GRAPH_PRESETS } from "./graphStudio/data/graphPresets";
import ExportVideoModal from "./graphStudio/modals/ExportVideoModal";
import ParserModal from "./graphStudio/modals/ParserModal";
import ScriptModal from "./graphStudio/modals/ScriptModal";
import { useGraphStudioCanvasHandlers } from "./graphStudio/hooks/useGraphStudioCanvasHandlers";
import { useGraphStudioImportExport } from "./graphStudio/hooks/useGraphStudioImportExport";
import { useGraphStudioGraphModel } from "./graphStudio/hooks/useGraphStudioGraphModel";
import { useGraphStudioPlayback } from "./graphStudio/hooks/useGraphStudioPlayback";
import {
  useGraphStudioSelection,
  useGraphStudioSelectionPatchers,
} from "./graphStudio/hooks/useGraphStudioSelection";
import { useGraphStudioUndo } from "./graphStudio/hooks/useGraphStudioUndo";
import { useGraphStudioView } from "./graphStudio/hooks/useGraphStudioView";
import { cloneJson } from "./graphStudio/lib/undoUtils";
import "./graphStudio/graphStudio.css";
const GraphStudioVisualizer = ({ snapshot }) => {
  const seedTimeline = useMemo(
    () =>
      normalizeTimelinePayload(
        snapshot?.initialAnimation ?? snapshot?.initialGraph,
      ),
    [snapshot],
  );
  const {
    baseGraph,
    setBaseGraph,
    steps,
    frameCount,
    currentFrame,
    setCurrentFrame,
    computedGraph,
    getFrameGraph,
    addStep,
    updateStep,
    duplicateStep,
    removeStep,
    moveStep,
    replaceTimeline,
  } = useGraphAnimation(seedTimeline.baseGraph, seedTimeline.steps);
  const [mode, setMode] = useState("select");
  const [edgeRouting, setEdgeRouting] = useState(EDGE_ROUTING.straight);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const {
    viewState,
    setViewState,
    viewResetCounter,
    lockCanvas,
    setLockCanvas,
    setViewFromNodes,
    bumpViewReset,
    centerViewOnContent,
    zoomIn,
    zoomOut,
    zoomPercent,
  } = useGraphStudioView({
    initialNodes: seedTimeline.baseGraph.nodes,
  });
  const [status, setStatus] = useState("Ready");
  const [globalSettings, setGlobalSettings] = useState({
    forceStrength: 1,
    edgeCurvature: 46,
    nodeSize: 22,
    edgeWidth: 2.2,
  });
  const { resetUndoHistory } = useGraphStudioUndo({
    baseGraph,
    steps,
    currentFrame,
    replaceTimeline,
    setCurrentFrame,
    setStatus,
  });
  const { isPlaying, togglePlayback } = useGraphStudioPlayback({
    steps,
    frameCount,
    currentFrame,
    setCurrentFrame,
    setStatus,
  });
  const {
    selectedObject,
    setSelectedObject,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedNodeIdSet,
    selectedNode,
    selectedEdge,
    nodeConnectedEdges,
    edgeConnectedNodes,
    clearSelection,
  } = useGraphStudioSelection({ computedGraph });
  const {
    updateBaseNode,
    updateBaseNodesBulk,
    updateBaseEdge,
    setStepProperty,
    addNodeAt,
    addNode,
    addEdge,
    deleteSelection,
    applyLayout,
  } = useGraphStudioGraphModel({
    baseGraph,
    setBaseGraph,
    steps,
    currentFrame,
    updateStep,
    replaceTimeline,
    snapEnabled,
    forceStrength: globalSettings.forceStrength,
    setStatus,
    seedBaseGraph: seedTimeline.baseGraph,
    selectedNodeIds,
    selectedEdge,
    setSelectedObject,
    setSelectedNodeIds,
  });
  const {
    updateSelectedNode,
    updateSelectedEdge,
    applyPatchToSelectedNodes,
  } = useGraphStudioSelectionPatchers({
    selectedNode,
    selectedEdge,
    selectedNodeIds,
    updateBaseNode,
    updateBaseEdge,
    setStepProperty,
  });
  const {
    drawFrom,
    clearDrawState,
    handleSetMode,
    startDrawEdge,
    onSelectNode,
    onSelectEdge,
    onSelectNodes,
    onBackgroundClear,
    onNodeClickForDraw,
    onNodePointerDown,
    onNodeMove,
    onNodePointerUp,
  } = useGraphStudioCanvasHandlers({
    setMode,
    setStatus,
    baseGraph,
    addEdge,
    updateBaseNodesBulk,
    selectedNodeIds,
    selectedNodeIdSet,
    setSelectedObject,
    setSelectedNodeIds,
    clearSelection,
  });
  const {
    isParserOpen,
    setIsParserOpen,
    parserText,
    setParserText,
    applyParserText,
    isScriptOpen,
    setIsScriptOpen,
    scriptText,
    setScriptText,
    runScript,
    isExportVideoOpen,
    exportVideoLabelPos,
    setExportVideoLabelPos,
    exportText,
    openExportVideoModal,
    closeExportVideoModal,
    confirmExportVideo,
  } = useGraphStudioImportExport({
    baseGraph,
    steps,
    setCurrentFrame,
    replaceTimeline,
    setStatus,
  });
  useEffect(() => {
    replaceTimeline(seedTimeline.baseGraph, seedTimeline.steps);
    setViewFromNodes(seedTimeline.baseGraph.nodes);
    clearSelection();
    clearDrawState();
    resetUndoHistory();
    bumpViewReset();
  }, [
    seedTimeline,
    replaceTimeline,
    resetUndoHistory,
    setViewFromNodes,
    bumpViewReset,
    clearSelection,
    clearDrawState,
  ]);
  const previousGraph = useMemo(() => {
    if (currentFrame <= 0) return computedGraph;
    return getFrameGraph(currentFrame - 1);
  }, [currentFrame, getFrameGraph, computedGraph]);
  const diff = useMemo(
    () => computeStepDiff(previousGraph, computedGraph),
    [previousGraph, computedGraph],
  );
  const applyPreset = (presetName) => {
    const preset = GRAPH_PRESETS[presetName];
    if (!preset) return;
    const nextGraph = cloneJson(preset.graph);
    const nextSteps = cloneJson(preset.steps);
    replaceTimeline(nextGraph, nextSteps);
    setViewFromNodes(nextGraph.nodes);
    setStatus(`Applied ${presetName.toUpperCase()} preset`);
  };
  return (
    <div className="h-full min-h-0 bg-surface font-inter text-on-surface text-on-surface">
      {" "}
      <PanelGroup orientation="vertical" className="h-full">
        {" "}
        <Panel defaultSize="76%" minSize="52%">
          {" "}
          <PanelGroup orientation="horizontal" className="h-full">
            {" "}
            <Panel defaultSize="18%" minSize="14%">
              {" "}
              <LeftSidebar
                mode={mode}
                setMode={handleSetMode}
                drawFrom={drawFrom}
                onDrawEdge={startDrawEdge}
                routing={edgeRouting}
                setRouting={setEdgeRouting}
                snapEnabled={snapEnabled}
                setSnapEnabled={setSnapEnabled}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                lockCanvas={lockCanvas}
                setLockCanvas={setLockCanvas}
                onAddNode={addNode}
                onAutoLayout={applyLayout}
                onOpenParser={() => setIsParserOpen(true)}
                onExportText={exportText}
                onExportVideo={openExportVideoModal}
                onOpenScript={() => setIsScriptOpen(true)}
                selectedCount={selectedNodeIds.length}
                onApplyPreset={applyPreset}
                currentFrame={currentFrame}
                totalFrames={frameCount}
                onPlay={togglePlayback}
                isPlaying={isPlaying}
                onCenterView={centerViewOnContent}
                zoomPercent={zoomPercent}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
              />{" "}
            </Panel>{" "}
            <PanelResizeHandle className="graphstudio-resize" />{" "}
            <Panel minSize="40%" defaultSize="60%">
              {" "}
              <motion.div
                className="relative h-full"
                layoutId="graphstudio-main-canvas"
              >
                {" "}
                <GraphCanvas
                  graph={computedGraph}
                  previousGraph={previousGraph}
                  diff={diff}
                  selectedObject={selectedObject}
                  selectedNodeIds={selectedNodeIdSet}
                  drawFrom={drawFrom}
                  mode={mode}
                  viewState={viewState}
                  setViewState={setViewState}
                  showGrid={showGrid}
                  snapEnabled={snapEnabled}
                  lockCanvas={lockCanvas}
                  edgeRouting={edgeRouting}
                  edgeCurvature={globalSettings.edgeCurvature}
                  nodeRadius={globalSettings.nodeSize}
                  edgeWidth={globalSettings.edgeWidth}
                  resetViewTrigger={viewResetCounter}
                  onSelectNode={onSelectNode}
                  onSelectEdge={onSelectEdge}
                  onSelectNodes={onSelectNodes}
                  onBackgroundClear={onBackgroundClear}
                  onNodePointerDown={onNodePointerDown}
                  onNodeMove={onNodeMove}
                  onNodePointerUp={onNodePointerUp}
                  onNodeClickForDraw={onNodeClickForDraw}
                  onCanvasDoubleClick={addNodeAt}
                />{" "}
                <div className="absolute left-3 bottom-3 z-20 px-2 py-1 rounded bg-surface-container-low/90 text-[11px] text-on-surface">
                  {" "}
                  {status}{" "}
                </div>{" "}
              </motion.div>{" "}
            </Panel>{" "}
            <PanelResizeHandle className="graphstudio-resize" />{" "}
            <Panel defaultSize="22%" minSize="16%">
              {" "}
              <PropertyPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                connectedEdges={nodeConnectedEdges}
                connectedNodes={edgeConnectedNodes}
                multiSelection={selectedNodeIds}
                globalSettings={globalSettings}
                onUpdateNode={updateSelectedNode}
                onUpdateEdge={updateSelectedEdge}
                onSelectEdge={(edgeId) => onSelectEdge(edgeId)}
                onSelectNode={(nodeId) => onSelectNode(nodeId, false)}
                onApplyToSelection={applyPatchToSelectedNodes}
                onDeleteSelection={deleteSelection}
                onUpdateGlobal={(patch) =>
                  setGlobalSettings((prev) => ({ ...prev, ...patch }))
                }
              />{" "}
            </Panel>{" "}
          </PanelGroup>{" "}
        </Panel>{" "}
        <PanelResizeHandle className="graphstudio-resize-horizontal" />{" "}
        <Panel defaultSize="24%" minSize="14%">
          {" "}
          <TimelinePanel
            steps={steps}
            currentFrame={currentFrame}
            onFrameChange={setCurrentFrame}
            onStepDurationChange={(index, value) =>
              updateStep(index, "durationMs", value)
            }
            onDescriptionChange={(index, value) =>
              updateStep(index, "description", value)
            }
            onAddStep={() => {
              addStep(currentFrame);
              setCurrentFrame(currentFrame + 1);
            }}
            onDuplicateStep={() => {
              duplicateStep(currentFrame);
              setCurrentFrame(currentFrame + 1);
            }}
            onDeleteStep={() => {
              if (steps.length <= 1) return;
              removeStep(currentFrame);
              setCurrentFrame(Math.max(0, currentFrame - 1));
            }}
            onMoveStep={moveStep}
            onPlay={togglePlayback}
            isPlaying={isPlaying}
          />{" "}
        </Panel>{" "}
      </PanelGroup>
      <ParserModal
        open={isParserOpen}
        text={parserText}
        onTextChange={setParserText}
        onClose={() => setIsParserOpen(false)}
        onSubmit={applyParserText}
      />
      <ScriptModal
        open={isScriptOpen}
        text={scriptText}
        onTextChange={setScriptText}
        onClose={() => setIsScriptOpen(false)}
        onSubmit={runScript}
        defaultScript={DEFAULT_SCRIPT}
      />
      <ExportVideoModal
        open={isExportVideoOpen}
        labelPos={exportVideoLabelPos}
        onLabelPosChange={setExportVideoLabelPos}
        onClose={closeExportVideoModal}
        onExport={confirmExportVideo}
      />
    </div>
  );
};
export default GraphStudioVisualizer;
